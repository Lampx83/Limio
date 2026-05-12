import { prisma } from "@feedbackme/db";

function normalizePhrase(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, "")
    .trim();
}

function countPhrases(submissions: { text: string }[]): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const { text } of submissions) {
    const phrase = normalizePhrase(text);
    if (phrase.length === 0) continue;
    freq[phrase] = (freq[phrase] || 0) + 1;
  }
  return freq;
}

export async function GET(
  req: Request,
  { params }: { params: { cloudId: string } }
) {
  try {
    // Verify word cloud exists
    const wordCloud = await prisma.wordCloud.findUnique({
      where: { id: params.cloudId },
      select: { id: true },
    });

    if (!wordCloud) {
      return Response.json(
        { error: "Word cloud not found" },
        { status: 404 }
      );
    }

    // Fetch all submissions
    const submissions = await prisma.wordCloudSubmission.findMany({
      where: { cloudId: params.cloudId },
      select: { text: true },
    });

    // Aggregate word frequencies
    const wordFrequency = countPhrases(submissions);

    return Response.json({
      cloudId: params.cloudId,
      totalSubmissions: submissions.length,
      wordFrequency,
    });
  } catch (err) {
    console.error("[classroom/word-cloud/results]", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
