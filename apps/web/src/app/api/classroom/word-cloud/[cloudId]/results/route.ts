import { prisma } from "@feedbackme/db";

// Stop words in English and Vietnamese
const STOP_WORDS = new Set([
  // English
  "the", "a", "an", "and", "or", "is", "are", "be", "to", "of", "in", "on", "at", "by", "for", "with", "from", "as", "was", "were", "been", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can", "it", "this", "that", "these", "those", "i", "you", "he", "she", "we", "they", "me", "him", "her", "us", "them", "what", "which", "who", "when", "where", "why", "how",
  // Vietnamese
  "là", "và", "của", "có", "được", "như", "từ", "trong", "trên", "hay", "hoặc", "nếu", "khi", "mà", "sẽ", "đã", "đang", "không", "các", "cái", "chiếc", "những", "cơ", "về", "cho", "với", "qua", "do", "nơi", "bởi", "vì", "nên", "mặc", "dù", "tuy", "nhên", "nhưng", "song", "tuy", "vậy", "thế", "mà", "nên", "thì", "để", "nhằm", "phục", "vụ",
]);

function tokenizeAndCountWords(submissions: { text: string }[]): Record<string, number> {
  const wordFrequency: Record<string, number> = {};

  for (const submission of submissions) {
    // Split by whitespace and normalize
    const words = submission.text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 0);

    for (const word of words) {
      // Skip stop words
      if (STOP_WORDS.has(word)) {
        continue;
      }

      // Remove punctuation from edges
      const cleanWord = word.replace(/^[^\w]+|[^\w]+$/g, "");

      if (cleanWord.length > 0) {
        wordFrequency[cleanWord] = (wordFrequency[cleanWord] || 0) + 1;
      }
    }
  }

  return wordFrequency;
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
    const wordFrequency = tokenizeAndCountWords(submissions);

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
