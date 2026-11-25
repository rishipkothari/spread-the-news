import NewsView from "../_components/NewsView";

export const dynamic = "force-dynamic";
export const metadata = { title: "News · PRISM" };

export default async function NewsHome({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  return <NewsView section="all" date={date} />;
}
