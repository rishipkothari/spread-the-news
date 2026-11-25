import { notFound } from "next/navigation";
import NewsView from "../../_components/NewsView";
import { isSection, sectionLabel } from "../../_components/sections";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return { title: `${isSection(section) ? sectionLabel(section) : "News"} · PRISM` };
}

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ date?: string }> }) {
  const [{ section }, { date }] = await Promise.all([params, searchParams]);
  if (!isSection(section)) notFound();
  return <NewsView section={section} date={date} />;
}
