import { FieldLensApp } from "@/components/fieldlens-app";

export default function Home() {
  return <FieldLensApp repositoryUrl={process.env.NEXT_PUBLIC_REPOSITORY_URL} />;
}
