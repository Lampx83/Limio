import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserNotifications, getUnreadCount } from "@/lib/notifications";
import { prisma } from "@feedbackme/db";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [items, unread, user] = await Promise.all([
    getUserNotifications(userId, 20),
    getUnreadCount(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { notificationsLastSeenAt: true },
    }),
  ]);
  return NextResponse.json({
    items,
    unread,
    lastSeenAt: user?.notificationsLastSeenAt ?? null,
  });
}
