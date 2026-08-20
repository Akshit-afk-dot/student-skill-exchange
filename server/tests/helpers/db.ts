import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo: MongoMemoryServer | null = null;

/**
 * Boots an in-memory MongoDB and points mongoose at it.
 *
 * A real mongod (not a mock) is used deliberately: the parts most worth testing here
 * are unique indexes, partial indexes, aggregation pipelines and geo queries, none of
 * which a mock would exercise.
 */
export async function startTestDb(): Promise<string> {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri);
  // Index builds are async by default; tests assert on unique-index violations, so
  // every index must exist before the first insert.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
  return uri;
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await mongo?.stop();
  mongo = null;
}

/** Empties every collection while leaving indexes in place. */
export async function clearDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}
