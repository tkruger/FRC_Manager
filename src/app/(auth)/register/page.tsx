import { oauthProviders } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return <RegisterForm providers={oauthProviders()} />;
}
