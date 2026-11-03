import { LEGAL } from '../../config/legal';
import { escapeHtml } from '../../utils/html';

const contact = `<a href="mailto:${escapeHtml(LEGAL.contactEmail)}">${escapeHtml(LEGAL.contactEmail)}</a>`;
const operator = escapeHtml(LEGAL.operator);

/**
 * The privacy policy. Written against what the code actually stores — keep the two in
 * step: a new field on User, or a new third-party service, needs a line here.
 */
export function privacyPolicyHtml(appName: string, deletionUrl: string): string {
  const app = escapeHtml(appName);
  return `
<h1>Privacy policy</h1>
<p class="muted">Last updated ${escapeHtml(LEGAL.lastUpdated)}</p>

<p>${app} is a peer-to-peer skill exchange for students, operated by ${operator} ("we", "us"). This policy explains what we collect when you use the ${app} mobile app, why, who we share it with, and how to delete it. Contact us at ${contact} with any question.</p>

<h2>What we collect</h2>
<ul>
  <li><strong>Account details:</strong> your name, email address and password. Passwords are stored only as a one-way hash; we cannot read them. If you sign in with Google, we receive your name, email address and Google account identifier instead of a password.</li>
  <li><strong>Profile:</strong> anything you add, such as your college, department, year of study, bio, profile photo, languages, availability, time zone and preferred teaching mode.</li>
  <li><strong>Skills:</strong> the skills you can teach and want to learn, with your level in each.</li>
  <li><strong>Location, only if you allow it:</strong> your device's location, used to show how far away other students are. Other students see your city, never your coordinates. You can refuse or withdraw location permission at any time in your device settings.</li>
  <li><strong>Activity:</strong> learning requests, connections, chat messages and files you send, scheduled sessions (time, mode, meeting link or place, notes), reviews and ratings, reports you file, and points and badges you earn.</li>
  <li><strong>Notifications, only if you allow them:</strong> a push-notification token for your device.</li>
  <li><strong>Technical data:</strong> when you sign in we record the IP address and device type for that session, so you can stay signed in securely. Our servers also keep short-lived logs of requests.</li>
</ul>
<p>We do not show ads, we do not sell your data, and the app contains no advertising or analytics trackers.</p>

<h2>Why we use it</h2>
<ul>
  <li>To run the service: your profile, matching you with students whose skills complement yours, requests, chat, sessions and reviews.</li>
  <li>To keep the community safe: verifying email addresses, reviewing reports, and acting against accounts that break the rules.</li>
  <li>To secure your account: signing you in, detecting stolen sessions, and resetting passwords.</li>
  <li>To contact you about your account, such as verification and password-reset emails. We do not send marketing email.</li>
</ul>

<h2>What other students can see</h2>
<p>Other students can see your public profile: name, photo, college, department, year, bio, city, languages, availability, skills, ratings and reviews, badges, and whether you are online. They never see your email address, password, exact location or the people you have blocked. Messages are visible only to you and the student you are talking to, and to moderators reviewing a report you or they have made.</p>

<h2>Who we share it with</h2>
<p>We use these service providers to run ${app}. They process data only on our behalf:</p>
<ul>
  <li><strong>MongoDB Atlas</strong> hosts our database.</li>
  <li><strong>Render</strong> hosts our application server.</li>
  <li><strong>Our email delivery provider</strong> sends verification and password-reset emails.</li>
  <li><strong>Google Firebase Cloud Messaging</strong> delivers push notifications, if you enable them.</li>
  <li><strong>Cloudinary</strong> stores uploaded images and files, where enabled.</li>
  <li><strong>Google</strong>, if you choose to sign in with Google.</li>
</ul>
<p>These providers may store data outside your country, including in the United States. We may also disclose information if the law requires it, or to protect the safety of our users.</p>

<h2>How long we keep it</h2>
<p>We keep your data for as long as your account exists. Sign-in records expire after 30 days, and notifications after 90 days. When you delete your account, your data is removed from our live database straight away (see below). Server logs and email delivery records may remain with our providers for a short period before they expire.</p>

<h2>Deleting your account</h2>
<p>You can delete your account at any time in the app under <strong>Settings → Delete account</strong>, or on the web at <a href="${escapeHtml(deletionUrl)}">${escapeHtml(deletionUrl)}</a>. This deletes your profile, skills, requests, connections, conversations (including messages and files), sessions, reviews you wrote and received, reports, blocks and notifications. Students who had upcoming sessions with you are told they were cancelled.</p>

<h2>Your choices and rights</h2>
<ul>
  <li>You can see and correct your profile at any time in the app.</li>
  <li>You can withdraw location and notification permissions in your device settings.</li>
  <li>You can ask us for a copy of your data, or ask us any question about it, by writing to ${contact}. We reply within 30 days.</li>
</ul>
<p>Depending on where you live, you may have further rights under local law, and you can raise a concern with your local data protection authority.</p>

<h2>Security</h2>
<p>All traffic between the app and our servers is encrypted in transit (HTTPS). Passwords and sign-in tokens are stored only as one-way hashes. No system is perfectly secure, so please use a password you do not use anywhere else.</p>

<h2>Age</h2>
<p>${app} is for students aged ${LEGAL.minimumAge} or over. We do not knowingly collect data from anyone younger; if you believe someone under ${LEGAL.minimumAge} has an account, contact us and we will delete it.</p>

<h2>Changes</h2>
<p>If we change this policy, we will update the date at the top, and tell you in the app if the change is significant.</p>
`;
}

/** Terms of use, including the zero-tolerance rule app stores expect of user-content apps. */
export function termsHtml(appName: string, privacyUrl: string): string {
  const app = escapeHtml(appName);
  return `
<h1>Terms of use</h1>
<p class="muted">Last updated ${escapeHtml(LEGAL.lastUpdated)}</p>

<p>These terms are an agreement between you and ${operator}, who operates ${app}. By creating an account you agree to them and to our <a href="${escapeHtml(privacyUrl)}">privacy policy</a>. If you do not agree, do not use ${app}.</p>

<h2>Who can use ${app}</h2>
<p>You must be at least ${LEGAL.minimumAge} years old and a student. You must give accurate information, keep your password private, and use only your own account. You are responsible for what happens on your account.</p>

<h2>What ${app} is</h2>
<p>${app} helps students find each other to exchange skills: you teach what you know and learn from others. Sessions are arranged directly between students. We do not employ, vet or supervise the students you meet, and we do not guarantee the quality of any session.</p>

<h2>Rules for everyone</h2>
<p><strong>We have zero tolerance for objectionable content and abusive users.</strong> You must not:</p>
<ul>
  <li>harass, bully, threaten or intimidate anyone;</li>
  <li>post hateful, sexual, violent or otherwise offensive content;</li>
  <li>send spam, advertising, scams, or requests for money or personal financial details;</li>
  <li>impersonate anyone, or misrepresent your skills or identity;</li>
  <li>share anyone else's personal information without their permission;</li>
  <li>break the law, or use ${app} to arrange anything illegal;</li>
  <li>try to break, overload, scrape or get unauthorised access to the service.</li>
</ul>

<h2>Reporting, blocking and moderation</h2>
<p>You can report any student or message, and block any student so that neither of you can find or contact the other. We review reports, and we may remove content, suspend or permanently ban accounts that break these rules, with or without notice. We aim to act on reports of objectionable content within 24 hours.</p>

<h2>Meeting in person</h2>
<p>If you arrange an in-person session, meet in a public place such as your campus, tell someone where you are going, and leave if you feel unsafe. You are responsible for your own safety and conduct, and for any arrangement you make with another student.</p>

<h2>Your content</h2>
<p>You own what you post. You give us permission to store, display and transmit it as needed to run ${app}, for as long as it remains on the service. You must have the right to post anything you share.</p>

<h2>Ending your account</h2>
<p>You can delete your account at any time in the app under Settings → Delete account. We may suspend or close accounts that break these terms.</p>

<h2>Disclaimers</h2>
<p>${app} is provided "as is" and "as available", without warranties of any kind. To the fullest extent the law allows, we are not liable for indirect or consequential losses, or for the conduct of any student, online or offline. Nothing in these terms limits liability that cannot be limited by law.</p>

<h2>Changes</h2>
<p>We may update these terms. If a change is significant we will tell you in the app; continuing to use ${app} after that means you accept the new terms.</p>

<h2>Law and contact</h2>
<p>These terms are governed by the laws of ${escapeHtml(LEGAL.governingLaw)}. Questions: ${contact}.</p>
`;
}
