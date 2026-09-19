"use client";

import { useState } from "react";
import { Users, Shuffle, RotateCcw, Maximize2, Minimize2, X, Minus, Plus } from "lucide-react";
import { toast } from "@/lib/toast";
import { GroupMemberCard } from "./GroupMemberCard";
import { apiUrl } from "@/lib/apiUrl";

const GROUP_STYLE = {
  bg: "bg-brand-50 dark:bg-brand-900/20",
  border: "border-brand-200 dark:border-brand-800",
  chip: "bg-brand-gradient",
  text: "text-brand-700 dark:text-brand-300",
};

interface GroupInfo {
  groupNum: number;
  members: Array<{
    userId: string;
    name: string;
    skillScore?: number;
  }>;
}

interface GroupingToolProps {
  lessonId?: string;
  studentList?: Array<{ name: string; id: string | null }>;
  onExit?: () => void;
  // Điền sẵn khi mở từ 1 event trong kịch bản lớp học (Activity Plan).
  initialMode?: GroupingMode;
  initialGroupSize?: number;
  initialNumGroups?: number;
}

type GroupingMode = "groupSize" | "numGroups";

export default function GroupingTool({
  lessonId,
  studentList,
  onExit,
  initialMode,
  initialGroupSize,
  initialNumGroups,
}: GroupingToolProps) {
  const [mode, setMode] = useState<GroupingMode>(initialMode ?? "groupSize");
  const [groupSize, setGroupSize] = useState(initialGroupSize ?? 3);
  const [numGroups, setNumGroups] = useState(initialNumGroups ?? 3);
  const [groups, setGroups] = useState<GroupInfo[] | null>(null);
  const [groupingId, setGroupingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isStateless = !!studentList && !lessonId;

  const handleCreateGroups = async () => {
    if ((mode === "groupSize" && groupSize < 1) || (mode === "numGroups" && numGroups < 1)) {
      toast.error("Vui lòng nhập giá trị hợp lệ");
      return;
    }

    setIsLoading(true);
    try {
      if (isStateless && studentList) {
        // Client-side mode: create groups without API call
        const students = studentList.map((s, idx) => ({
          userId: s.id || `local-${idx}`,
          name: s.name,
        }));

        let numGroupsToCreate = numGroups;
        if (mode === "groupSize") {
          numGroupsToCreate = Math.ceil(students.length / groupSize);
        }

        if (numGroupsToCreate === 0) {
          toast.error("Không đủ sinh viên để tạo nhóm");
          setIsLoading(false);
          return;
        }

        const newGroups: GroupInfo[] = Array.from({ length: numGroupsToCreate }, (_, i) => ({
          groupNum: i + 1,
          members: [],
        }));

        // Distribute students round-robin across groups
        students.forEach((student, idx) => {
          const groupIdx = idx % numGroupsToCreate;
          newGroups[groupIdx]!.members.push({
            userId: student.userId,
            name: student.name,
          });
        });

        setGroupingId(`local-${Date.now()}`);
        setGroups(newGroups);
        toast.success(
          `Tạo thành công ${numGroupsToCreate} nhóm cho ${students.length} sinh viên`
        );
        setIsLoading(false);
        return;
      }

      const payload =
        mode === "groupSize"
          ? { lessonId, groupSize }
          : { lessonId, numGroups };

      const res = await fetch(apiUrl("/api/classroom/grouping/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Lỗi tạo nhóm");
        return;
      }

      const data = await res.json();
      setGroupingId(data.groupingId);
      setGroups(data.groups);
      toast.success(
        `Tạo thành công ${data.numGroups} nhóm cho ${data.totalStudents} sinh viên`
      );
    } catch (err) {
      console.error("[GroupingTool]", err);
      toast.error("Lỗi mạng");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateGroups = async () => {
    if (!groupingId) return;

    setIsLoading(true);
    try {
      if (isStateless && studentList) {
        // Client-side mode: regenerate groups without API call
        const students = studentList.map((s, idx) => ({
          userId: s.id || `local-${idx}`,
          name: s.name,
        }));

        let numGroupsToCreate = numGroups;
        if (mode === "groupSize") {
          numGroupsToCreate = Math.ceil(students.length / groupSize);
        }

        const newGroups: GroupInfo[] = Array.from({ length: numGroupsToCreate }, (_, i) => ({
          groupNum: i + 1,
          members: [],
        }));

        // Shuffle and distribute students round-robin across groups
        const shuffled = [...students].sort(() => Math.random() - 0.5);
        shuffled.forEach((student, idx) => {
          const groupIdx = idx % numGroupsToCreate;
          newGroups[groupIdx]!.members.push({
            userId: student.userId,
            name: student.name,
          });
        });

        setGroups(newGroups);
        toast.success("Chia lại nhóm thành công");
        setIsLoading(false);
        return;
      }

      const payload =
        mode === "groupSize"
          ? { lessonId, groupSize }
          : { lessonId, numGroups };

      const res = await fetch(apiUrl("/api/classroom/grouping/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Lỗi chia lại nhóm");
        return;
      }

      const data = await res.json();
      setGroupingId(data.groupingId);
      setGroups(data.groups);
      toast.success("Chia lại nhóm thành công");
    } catch (err) {
      console.error("[GroupingTool - Regenerate]", err);
      toast.error("Lỗi mạng");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setGroups(null);
    setGroupingId(null);
    setDraggedUserId(null);
  };

  const handleDragStart = (userId: string) => {
    setDraggedUserId(userId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnGroup = async (groupNum: number) => {
    if (!draggedUserId || !groups || !groupingId) return;

    // Find current group of dragged user
    let currentGroupNum = -1;
    for (const group of groups) {
      if (group.members.some((m) => m.userId === draggedUserId)) {
        currentGroupNum = group.groupNum;
        break;
      }
    }

    if (currentGroupNum === groupNum) {
      setDraggedUserId(null);
      return;
    }

    // Prepare new group structure
    const newGroups = groups.map((group) => {
      const newMembers = group.members.filter(
        (m) => m.userId !== draggedUserId
      );

      if (group.groupNum === groupNum) {
        const draggedMember = groups
          .find((g) => g.groupNum === currentGroupNum)
          ?.members.find((m) => m.userId === draggedUserId);
        if (draggedMember) {
          newMembers.push(draggedMember);
        }
      }

      return { ...group, members: newMembers };
    });

    setGroups(newGroups);
    setDraggedUserId(null);

    // Skip API call in stateless mode (client-side only)
    if (isStateless) {
      toast.success("Cập nhật nhóm thành công");
      return;
    }

    // Persist to backend
    try {
      const payload = {
        groups: newGroups.map((g) => ({
          groupNum: g.groupNum,
          userIds: g.members.map((m) => m.userId),
        })),
      };

      const res = await fetch(
        `/api/classroom/grouping/${groupingId}/update`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        toast.error("Lỗi cập nhật nhóm");
        return;
      }

      toast.success("Cập nhật nhóm thành công");
    } catch (err) {
      console.error("[GroupingTool - Drop]", err);
      toast.error("Lỗi mạng");
    }
  };

  const totalStudents = studentList?.length ?? 0;
  const currentValue = mode === "groupSize" ? groupSize : numGroups;
  const setCurrentValue = (v: number) => {
    const safe = Math.max(1, v);
    if (mode === "groupSize") setGroupSize(safe);
    else setNumGroups(safe);
  };

  const previewStat =
    mode === "groupSize"
      ? totalStudents > 0
        ? `≈ ${Math.ceil(totalStudents / groupSize)} nhóm`
        : null
      : totalStudents > 0
      ? `≈ ${Math.ceil(totalStudents / numGroups)} người/nhóm`
      : null;

  // Show form if no groups created yet
  if (!groups || !groupingId) {
    return (
      <div className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-6 sm:p-8 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
            <Users size={22} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-xl font-bold">Chia nhóm</h3>
            {totalStudents > 0 && (
              <p className="text-sm text-muted">
                Sẵn sàng chia <span className="font-medium">{totalStudents}</span> sinh viên
              </p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {/* Mode toggle + stepper on the same row */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-muted">Cách chia</label>
              <div className="inline-flex rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-1">
                <button
                  type="button"
                  onClick={() => setMode("groupSize")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    mode === "groupSize"
                      ? "bg-[rgb(var(--surface))] text-brand-700 shadow-sm"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  Số người / nhóm
                </button>
                <button
                  type="button"
                  onClick={() => setMode("numGroups")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    mode === "numGroups"
                      ? "bg-[rgb(var(--surface))] text-brand-700 shadow-sm"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  Tổng số nhóm
                </button>
              </div>
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-muted">
                {mode === "groupSize" ? "Số người mỗi nhóm" : "Tổng số nhóm"}
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-xl border border-token bg-[rgb(var(--surface))] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCurrentValue(currentValue - 1)}
                    disabled={currentValue <= 1}
                    className="flex h-11 w-11 items-center justify-center text-muted transition hover:bg-[rgb(var(--surface-muted))] disabled:opacity-30"
                    aria-label="Giảm"
                  >
                    <Minus size={18} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(parseInt(e.target.value) || 1)}
                    className="h-11 w-16 border-x border-token bg-transparent text-center text-lg font-semibold focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setCurrentValue(currentValue + 1)}
                    className="flex h-11 w-11 items-center justify-center text-muted transition hover:bg-[rgb(var(--surface-muted))]"
                    aria-label="Tăng"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {previewStat && (
                  <span className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                    {previewStat}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Create button */}
          <button
            onClick={handleCreateGroups}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-brand-glow disabled:opacity-50"
          >
            <Shuffle size={16} />
            {isLoading ? "Đang tạo..." : "Tạo nhóm"}
          </button>
        </div>
      </div>
    );
  }

  const totalAssigned = groups.reduce((sum, g) => sum + g.members.length, 0);

  const headerStats = (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
        <Users size={22} strokeWidth={2} />
      </div>
      <div>
        <h3 className="text-xl font-bold leading-tight">{groups.length} nhóm</h3>
        <p className="text-sm text-muted">{totalAssigned} sinh viên đã chia</p>
      </div>
    </div>
  );

  const actionBtn = "inline-flex items-center gap-1.5 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-fg transition hover:bg-[rgb(var(--surface-muted))] disabled:opacity-50";

  const renderActions = (fullscreen: boolean) => (
    <div className="flex flex-wrap gap-2">
      <button onClick={handleRegenerateGroups} disabled={isLoading} className={actionBtn}>
        <Shuffle size={14} /> {isLoading ? "Đang chia lại..." : "Chia lại"}
      </button>
      <button onClick={handleReset} disabled={isLoading} className={actionBtn}>
        <RotateCcw size={14} /> Reset
      </button>
      <button
        onClick={() => setIsFullscreen(!fullscreen)}
        disabled={isLoading}
        className={actionBtn}
      >
        {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        {fullscreen ? "Thoát" : "Toàn màn hình"}
      </button>
      {onExit && (
        <button onClick={onExit} className={actionBtn}>
          <X size={14} /> Đóng
        </button>
      )}
    </div>
  );

  const renderGroupGrid = (fullscreen: boolean) => (
    <div
      className={`grid gap-5 ${
        fullscreen
          ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          : "sm:grid-cols-2 lg:grid-cols-3"
      }`}
    >
      {groups.map((group) => {
        return (
          <div
            key={group.groupNum}
            onDragOver={handleDragOver}
            onDrop={() => handleDropOnGroup(group.groupNum)}
            className={`rounded-2xl border ${GROUP_STYLE.border} ${GROUP_STYLE.bg} p-4 shadow-sm transition hover:shadow-md`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${GROUP_STYLE.chip} text-sm font-bold text-white shadow-sm`}
                >
                  {group.groupNum}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${GROUP_STYLE.text}`}>
                    Nhóm {group.groupNum}
                  </p>
                  <p className="text-xs text-muted">
                    {group.members.length} thành viên
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {group.members.length === 0 ? (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-token py-6 text-xs text-muted">
                  Kéo sinh viên vào đây
                </div>
              ) : (
                group.members.map((member) => (
                  <div
                    key={member.userId}
                    onDragStart={() => handleDragStart(member.userId)}
                  >
                    <GroupMemberCard
                      userId={member.userId}
                      name={member.name}
                      skillScore={member.skillScore}
                      draggable
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[rgb(var(--bg))] p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-token pb-4">
          {headerStats}
          {renderActions(true)}
        </div>
        {renderGroupGrid(true)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card">
        {headerStats}
        {renderActions(false)}
      </div>
      {renderGroupGrid(false)}
    </div>
  );
}
