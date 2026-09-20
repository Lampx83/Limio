// Danh sách "thiết lập xong chưa" hiện ở đầu trang quản lý đấu trường (khi còn nháp).
// Tách thành hàm thuần để test, và để cùng một quy tắc với kiểm tra công bố ở máy chủ.

import { prizeSetupIssue } from "@feedbackme/core-gamification";

export type SetupTab = "basic" | "missions" | "prize" | "judges";
export type SetupStep = {
  id: "info" | "missions" | "prize" | "judges" | "publish";
  label: string;
  state: "done" | "todo" | "optional";
  hint: string;
  tab: SetupTab | null;
};

export type SetupInput = {
  status: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  missionCount: number;
  prizeXp: number;
  prizeDistribution: unknown;
  judgeCount: number;
};

const blankHtml = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim().length === 0;

export function buildSetupSteps(t: SetupInput): { steps: SetupStep[]; readyToPublish: boolean } {
  const infoOk = t.title.trim().length > 0 && !blankHtml(t.description) && t.endsAt > t.startsAt;
  const info: SetupStep = {
    id: "info",
    label: "Thông tin đấu trường",
    state: infoOk ? "done" : "todo",
    hint: infoOk ? "Tiêu đề, mô tả và thời gian" : "Cần tiêu đề, mô tả và thời gian kết thúc sau thời gian bắt đầu",
    tab: "basic",
  };

  const missions: SetupStep = {
    id: "missions",
    label: "Nhiệm vụ",
    state: t.missionCount > 0 ? "done" : "todo",
    hint: t.missionCount > 0 ? `${t.missionCount} nhiệm vụ` : "Thêm ít nhất 1 nhiệm vụ",
    tab: "missions",
  };

  const issue = prizeSetupIssue({ prizeXp: t.prizeXp, prizeDistribution: t.prizeDistribution });
  const prize: SetupStep =
    t.prizeXp <= 0
      ? { id: "prize", label: "Giải thưởng", state: "optional", hint: "Chưa đặt XP thưởng (không bắt buộc)", tab: "prize" }
      : issue === "distribution_missing"
        ? { id: "prize", label: "Giải thưởng", state: "todo", hint: "Chia XP thưởng theo hạng, nếu không sẽ không ai nhận", tab: "prize" }
        : issue === "sum_over_100"
          ? { id: "prize", label: "Giải thưởng", state: "todo", hint: "Tổng tỷ lệ chia thưởng đang vượt 100%", tab: "prize" }
          : { id: "prize", label: "Giải thưởng", state: "done", hint: "Đã chia XP thưởng theo hạng", tab: "prize" };

  const judges: SetupStep = {
    id: "judges",
    label: "Giám khảo",
    state: t.judgeCount > 0 ? "done" : "optional",
    hint: t.judgeCount > 0 ? `${t.judgeCount} giám khảo` : "Không bắt buộc, chỉ cần khi chấm chéo theo nhóm",
    tab: "judges",
  };

  const readyToPublish = [info, missions, prize].every((s) => s.state !== "todo");
  const published = t.status !== "draft";
  const publish: SetupStep = {
    id: "publish",
    label: "Công bố",
    state: published ? "done" : "todo",
    hint: published
      ? "Đã công bố"
      : readyToPublish
        ? "Sẵn sàng. Bấm Công bố ở thanh phía trên"
        : "Hoàn thành các bước còn lại trước",
    tab: null,
  };

  return { steps: [info, missions, prize, judges, publish], readyToPublish };
}
