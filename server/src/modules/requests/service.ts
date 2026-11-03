import { Types } from 'mongoose';
import {
  Connection,
  Conversation,
  LearningRequest,
  Skill,
  User,
  UserSkill,
  pairKeyOf,
  type LearningRequestDoc,
} from '../../models';
import { RT, emitToUser } from '../../realtime/bus';
import type { RequestStatus } from '../../types/domain';
import { ApiError } from '../../utils/errors';
import { isBlockedBetween } from '../blocks/service';
import { paginate, type Paginated } from '../../utils/pagination';
import { notify } from '../notifications/service';

export interface CreateRequestInput {
  receiverId: string;
  skillId: string;
  offeredSkillId?: string;
  message: string;
}

/**
 * Sends a learning request.
 *
 * The requested skill must actually be on the receiver's teaching list — otherwise the
 * request is meaningless and the receiver has nothing to accept.
 */
export async function createRequest(
  senderId: string,
  input: CreateRequestInput,
): Promise<LearningRequestDoc> {
  if (senderId === input.receiverId) {
    throw ApiError.badRequest('You cannot send a learning request to yourself');
  }
  // Deliberately the same wording whichever side blocked: it must not reveal who did.
  if (await isBlockedBetween(senderId, input.receiverId)) {
    throw ApiError.forbidden('You cannot send a request to this student');
  }

  const [receiver, skill] = await Promise.all([
    User.findById(input.receiverId),
    Skill.findById(input.skillId),
  ]);
  if (!receiver || receiver.status !== 'ACTIVE') throw ApiError.notFound('Student not found');
  if (!skill) throw ApiError.notFound('Skill not found');

  const teaches = await UserSkill.exists({
    user: receiver._id,
    skill: skill._id,
    type: 'TEACH',
  });
  if (!teaches) throw ApiError.badRequest(`${receiver.name} does not teach ${skill.name}`);

  if (input.offeredSkillId) {
    const offers = await UserSkill.exists({
      user: senderId,
      skill: input.offeredSkillId,
      type: 'TEACH',
    });
    if (!offers) {
      throw ApiError.badRequest('You can only offer a skill that is on your own teaching list');
    }
  }

  let request: LearningRequestDoc;
  try {
    request = await LearningRequest.create({
      sender: senderId,
      receiver: receiver._id,
      skill: skill._id,
      offeredSkill: input.offeredSkillId,
      message: input.message,
      status: 'PENDING',
    });
  } catch (err) {
    // The partial unique index rejects a second pending request for the same skill.
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      throw ApiError.conflict(`You already have a pending request to ${receiver.name} for ${skill.name}`);
    }
    throw err;
  }

  const sender = await User.findById(senderId).select('name').lean();
  await notify({
    user: receiver._id,
    type: 'REQUEST_RECEIVED',
    title: 'New learning request',
    body: `${sender?.name ?? 'A student'} wants to learn ${skill.name} from you`,
    data: { requestId: String(request._id), screen: 'LearningRequests' },
  });
  emitToUser(String(receiver._id), RT.REQUEST_NEW, { requestId: String(request._id) });

  return request;
}

export interface ListRequestsInput {
  direction: 'incoming' | 'outgoing';
  status?: RequestStatus;
  page: number;
  limit: number;
}

export async function listRequests(userId: string, input: ListRequestsInput): Promise<Paginated<unknown>> {
  const filter: Record<string, unknown> =
    input.direction === 'incoming' ? { receiver: userId } : { sender: userId };
  if (input.status) filter.status = input.status;

  const skip = (input.page - 1) * input.limit;
  const [items, total] = await Promise.all([
    LearningRequest.find(filter)
      .populate('sender', 'name profileImage college ratingAvg ratingCount isOnline')
      .populate('receiver', 'name profileImage college ratingAvg ratingCount isOnline')
      .populate('skill', 'name')
      .populate('offeredSkill', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(input.limit)
      .lean(),
    LearningRequest.countDocuments(filter),
  ]);

  return paginate(items, total, input);
}

async function loadOwnRequest(
  requestId: string,
  userId: string,
  side: 'sender' | 'receiver',
): Promise<LearningRequestDoc> {
  if (!Types.ObjectId.isValid(requestId)) throw ApiError.badRequest('Invalid request id');
  const request = await LearningRequest.findById(requestId);
  if (!request) throw ApiError.notFound('Request not found');

  const owner = side === 'sender' ? request.sender : request.receiver;
  if (String(owner) !== userId) {
    throw ApiError.forbidden(
      side === 'receiver'
        ? 'Only the recipient can respond to this request'
        : 'Only the sender can cancel this request',
    );
  }
  return request;
}

/**
 * Idempotently ensures a connection and its conversation exist for a pair.
 *
 * Both documents key off a direction-independent `pairKey` with a unique index, so two
 * simultaneous accepts converge on the same pair rather than creating duplicates. This
 * uses upserts rather than a transaction so it works on a standalone mongod as well as
 * a replica set.
 */
export async function ensureConnection(
  a: string | Types.ObjectId,
  b: string | Types.ObjectId,
  originRequest?: Types.ObjectId,
): Promise<{ connectionId: Types.ObjectId; conversationId: Types.ObjectId }> {
  const key = pairKeyOf(a, b);
  const participants = [new Types.ObjectId(String(a)), new Types.ObjectId(String(b))];

  const conversation = await Conversation.findOneAndUpdate(
    { pairKey: key },
    { $setOnInsert: { pairKey: key, participants } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  const connection = await Connection.findOneAndUpdate(
    { pairKey: key },
    {
      $setOnInsert: { pairKey: key, participants, originRequest },
      $set: { active: true, conversation: conversation._id },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  if (!conversation.connection) {
    conversation.connection = connection._id;
    await conversation.save();
  }

  return { connectionId: connection._id, conversationId: conversation._id };
}

export async function acceptRequest(requestId: string, userId: string) {
  const request = await loadOwnRequest(requestId, userId, 'receiver');
  if (request.status !== 'PENDING') {
    throw ApiError.conflict(`This request was already ${request.status.toLowerCase()}`);
  }

  request.status = 'ACCEPTED';
  request.respondedAt = new Date();
  await request.save();

  const { connectionId, conversationId } = await ensureConnection(
    request.sender,
    request.receiver,
    request._id,
  );

  const [receiver, skill] = await Promise.all([
    User.findById(request.receiver).select('name').lean(),
    Skill.findById(request.skill).select('name').lean(),
  ]);

  await notify({
    user: request.sender,
    type: 'REQUEST_ACCEPTED',
    title: 'Request accepted',
    body: `${receiver?.name ?? 'Your request'} accepted your request to learn ${skill?.name ?? 'a skill'}`,
    data: { conversationId: String(conversationId), screen: 'Chat' },
  });
  emitToUser(String(request.sender), RT.REQUEST_UPDATED, {
    requestId: String(request._id),
    status: 'ACCEPTED',
    conversationId: String(conversationId),
  });

  return { request, connectionId, conversationId };
}

export async function rejectRequest(requestId: string, userId: string) {
  const request = await loadOwnRequest(requestId, userId, 'receiver');
  if (request.status !== 'PENDING') {
    throw ApiError.conflict(`This request was already ${request.status.toLowerCase()}`);
  }

  request.status = 'REJECTED';
  request.respondedAt = new Date();
  await request.save();

  // Deliberately vague, and not pushed to the device: a rejection does not need to
  // buzz someone's phone, and naming the rejecter invites hard feelings.
  await notify({
    user: request.sender,
    type: 'REQUEST_REJECTED',
    title: 'Request declined',
    body: 'One of your learning requests was declined. Plenty of other students teach this skill.',
    data: { requestId: String(request._id), screen: 'LearningRequests' },
    push: false,
  });
  emitToUser(String(request.sender), RT.REQUEST_UPDATED, {
    requestId: String(request._id),
    status: 'REJECTED',
  });

  return request;
}

export async function cancelRequest(requestId: string, userId: string) {
  const request = await loadOwnRequest(requestId, userId, 'sender');
  if (request.status !== 'PENDING') {
    throw ApiError.conflict(`This request was already ${request.status.toLowerCase()}`);
  }

  request.status = 'CANCELLED';
  request.respondedAt = new Date();
  await request.save();
  return request;
}

export async function countPending(userId: string): Promise<number> {
  return LearningRequest.countDocuments({ receiver: userId, status: 'PENDING' });
}
