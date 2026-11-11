import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalContact, SOURCE_URL } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Service — FRC Manager" };

export default async function TermsPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  // Reached from What's new opened in the app: keep its ✕
  const fromApp = (await searchParams).from === "app";
  return (
    <LegalPage title="Terms of Service" updated="October 31, 2026" closable={fromApp}>
      <p>
        These terms apply to the FRC Manager web app and the FRC Manager Discord bot (together, &ldquo;the service&rdquo;).
        By creating an account, signing in, or using the bot, you agree to these terms. If you don&apos;t agree, please
        don&apos;t use the service.
      </p>

      <h2>The short version</h2>
      <ul>
        <li><b>It&apos;s free, open-source software, run on a best-effort basis.</b> There&apos;s no guaranteed uptime.</li>
        <li><b>Features can change, break or go away</b> at any time, without notice.</li>
        <li><b>You use it at your own risk and discretion.</b> Keep your own copies of anything important.</li>
        <li><b>You can host it yourself</b> — the source is on <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">GitHub</a>.</li>
        <li><b>Please don&apos;t use it to make money</b> — see below.</li>
      </ul>

      <h2>Who can use it</h2>
      <p>
        The service is for members, mentors and supporters of FIRST Robotics Competition teams. A team&apos;s leaders approve
        who joins their team and what role each person has. If you&apos;re under 18, use the service only with your
        team&apos;s and, where your team or school requires it, your parent&apos;s or guardian&apos;s permission.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Give accurate information, and keep your password private.</li>
        <li>You&apos;re responsible for what happens under your account. Tell your team&apos;s Head Mentor straight away if you think someone else has used it.</li>
        <li>Team leaders can change your roles or suspend your account for their team.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Use the service for your team&apos;s work. Do not:</p>
      <ul>
        <li>try to access another team&apos;s data, or anything your role doesn&apos;t allow;</li>
        <li>interfere with the service, overload it, or probe it for weaknesses without permission;</li>
        <li>upload anything unlawful, harmful, harassing or that you don&apos;t have the right to share;</li>
        <li>use the Discord bot to spam or to break Discord&apos;s rules.</li>
      </ul>

      <h2>Your team&apos;s content</h2>
      <p>
        Your team owns the records it puts into the service, such as tasks, inventory, orders and photos. You allow us to
        store, process and display that content only as needed to run the service for your team. See the{" "}
        <Link href={fromApp ? "/privacy?from=app" : "/privacy"}>Privacy Policy</Link> for how information is handled.
      </p>

      <h2>Orders and purchasing</h2>
      <p>
        The service helps a team track orders: requests, approvals, purchases and deliveries. It does not process payments
        or buy anything itself. Prices and product details filled in from vendor links are for convenience and may be out
        of date — always check with the vendor. Purchasing decisions remain your team&apos;s responsibility.
      </p>

      <h2>Discord</h2>
      <p>
        Using the bot also means following Discord&apos;s Terms of Service and Community Guidelines. A team&apos;s leaders
        choose which server and channels the bot uses. You can unlink your Discord account at any time with{" "}
        <code>/unlink</code>.
      </p>

      <h2>No guarantees: availability and features</h2>
      <p>
        FRC Manager is maintained by volunteers in their spare time. It&apos;s provided &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo;:
      </p>
      <ul>
        <li><b>There is no guaranteed uptime.</b> The service may be slow, unavailable or down for maintenance — including during build season or at a competition.</li>
        <li><b>Features aren&apos;t guaranteed to stay the same or to stay at all.</b> Anything may change, be removed or stop working, with or without notice, and the service itself may be discontinued.</li>
        <li><b>Data may be lost.</b> Export or keep your own copies of anything that matters, and don&apos;t rely on the service as your team&apos;s only record of important information, such as robot inspection or safety documentation required by FIRST.</li>
      </ul>
      <p>You&apos;re welcome to use it — but using it is at your own risk and discretion.</p>

      <h2>Open source, and hosting it yourself</h2>
      <p>
        FRC Manager is open-source software. If you want more control — your own uptime, your own data, your own
        changes — you&apos;re welcome to take the source code from{" "}
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">{SOURCE_URL.replace("https://", "")}</a>{" "}
        and run it yourself, under the terms of its license (Apache License 2.0, included with the code). A copy you host
        is yours to run; these terms cover only this hosted service.
      </p>

      <h2>Please don&apos;t use it to make money</h2>
      <p>
        FRC Manager is built for the FIRST community and given away for free. We ask that you don&apos;t charge others for
        it or use it to make money — for example, by selling access to it, reselling hosting of it, or bundling it into a
        paid product. This is a request in the spirit of the project; it doesn&apos;t change the open-source license the
        code is shared under.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent allowed by law, the service is provided without warranties of any kind, express or implied —
        including that it will be available, error-free, secure, or fit for a particular purpose. Its operators are not
        liable for any losses arising from using it or from being unable to use it, including lost data, missed deadlines,
        or orders, inspections or events affected by it.
      </p>

      <h2>Ending use</h2>
      <p>
        You can stop using the service at any time. Access may be suspended or ended for anyone who breaks these terms or
        puts the service or other teams at risk, and the service as a whole may be shut down.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may be updated as the service changes. We&apos;ll update the date at the top; continuing to use the
        service after a change means you accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms? <LegalContact />.</p>

      <p className="text-small text-(--color-text-secondary)">
        FRC Manager is not affiliated with or endorsed by FIRST® or Discord.
      </p>
    </LegalPage>
  );
}
