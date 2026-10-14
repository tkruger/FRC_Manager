import { oauthProviders } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginForm providers={oauthProviders()} oauthError={error} />;
}
