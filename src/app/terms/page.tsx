import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalContact } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Service — FRC Manager" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 4, 2026">
      <p>
        These terms apply to the FRC Manager web app and the FRC Manager Discord bot (together, &ldquo;the service&rdquo;).
        By creating an account, signing in, or using the bot, you agree to these terms. If you don&apos;t agree, please
        don&apos;t use the service.
      </p>

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
        <Link href="/privacy">Privacy Policy</Link> for how information is handled.
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

      <h2>Availability</h2>
      <p>
        We work to keep the service running, but it&apos;s provided &ldquo;as is&rdquo; and may sometimes be unavailable,
        change, or have mistakes. Don&apos;t rely on it as your team&apos;s only copy of important records, such as robot
        inspection or safety documentation required by FIRST.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent allowed by law, the service is provided without warranties of any kind, and its operators are
        not liable for indirect or consequential losses, lost data, or missed deadlines arising from using it.
      </p>

      <h2>Ending use</h2>
      <p>
        You can stop using the service at any time. Access may be suspended or ended for anyone who breaks these terms or
        puts the service or other teams at risk.
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
