// Type dùng chung giữa host (HostGameClient), participant (play/[code]) và
// component UI chia sẻ (Podium, CircularTimer...) — trước đây bị khai báo
// lặp lại y hệt ở 3 nơi, tách ra đây để tránh lệch shape khi sửa 1 chỗ quên
// chỗ kia. KHÔNG chứa logic — đúng quy ước packages/shared-types.

export type LiveParticipant = {
  participantId: string;
  displayName: string;
  avatarKey: string;
  teamId: string | null;
  totalScore: number;
  streak: number;
};

export type TeamStanding = {
  teamId: string;
  name: string;
  colorKey: string;
  avgScore: number;
  memberCount: number;
  members: LiveParticipant[];
};
