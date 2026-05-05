"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { toast } from "@/lib/toast";
import { GroupMemberCard } from "./GroupMemberCard";
import { apiUrl } from "@/lib/apiUrl";

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
}

type GroupingMode = "groupSize" | "numGroups";

export default function GroupingTool({
  lessonId,
  studentList,
  onExit,
}: GroupingToolProps) {
  const [mode, setMode] = useState<GroupingMode>("groupSize");
  const [groupSize, setGroupSize] = useState(3);
  const [numGroups, setNumGroups] = useState(3);
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

      const res = await fetch(apiUrl("/api/classroom/grouping/create", {
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

      const res = await fetch(apiUrl("/api/classroom/grouping/create", {
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

  // Show form if no groups created yet
  if (!groups || !groupingId) {
    return (
      <div className="rounded-lg border border-purple-200 bg-purple-50 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Users size={24} className="text-teal-600" strokeWidth={1.5} />
          <h3 className="text-lg font-bold text-purple-900">Chia nhóm</h3>
        </div>

        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="groupSize"
                checked={mode === "groupSize"}
                onChange={(e) => setMode(e.target.value as GroupingMode)}
                className="rounded"
              />
              <span className="text-sm font-medium">Số người/nhóm</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="numGroups"
                checked={mode === "numGroups"}
                onChange={(e) => setMode(e.target.value as GroupingMode)}
                className="rounded"
              />
              <span className="text-sm font-medium">Tổng số nhóm</span>
            </label>
          </div>

          {/* Input field */}
          <div>
            <label className="block text-sm font-medium text-purple-900">
              {mode === "groupSize"
                ? "Số người mỗi nhóm"
                : "Tổng số nhóm"}
            </label>
            <input
              type="number"
              min="1"
              value={mode === "groupSize" ? groupSize : numGroups}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                if (mode === "groupSize") {
                  setGroupSize(val);
                } else {
                  setNumGroups(val);
                }
              }}
              className="input mt-1 w-full"
            />
          </div>

          {/* Create button */}
          <button
            onClick={handleCreateGroups}
            disabled={isLoading}
            className="btn-primary w-full"
          >
            {isLoading ? "Đang tạo..." : "Tạo nhóm"}
          </button>
        </div>
      </div>
    );
  }

  // Show groups fullscreen
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-[rgb(var(--surface))] flex flex-col p-6 z-50 overflow-y-auto">
        {/* Fullscreen Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Users size={32} className="text-teal-600" strokeWidth={1.5} />
            <h3 className="text-2xl font-bold">{groups.length} nhóm</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRegenerateGroups}
              disabled={isLoading}
              className="btn-secondary text-sm"
            >
              {isLoading ? "Đang chia lại..." : "Chia lại"}
            </button>
            <button
              onClick={handleReset}
              disabled={isLoading}
              className="btn-secondary text-sm"
              title="Reset"
            >
              ↺ Reset
            </button>
            <button
              onClick={() => setIsFullscreen(false)}
              className="btn-secondary text-sm"
              title="Exit fullscreen"
            >
              ⛶ Thoát
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="btn-secondary text-sm"
                title="Exit tool"
              >
                ✕ Exit
              </button>
            )}
          </div>
        </div>

        {/* Groups grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div
              key={group.groupNum}
              onDragOver={handleDragOver}
              onDrop={() => handleDropOnGroup(group.groupNum)}
              className="rounded-lg border-2 border-dashed border-purple-200 bg-purple-50 p-4 transition-colors hover:border-purple-400"
            >
              {/* Group header */}
              <h4 className="mb-3 text-sm font-semibold text-purple-900">
                Nhóm {group.groupNum} ({group.members.length})
              </h4>

              {/* Members */}
              <div className="space-y-2">
                {group.members.length === 0 ? (
                  <p className="text-center text-xs text-purple-400">
                    Kéo sinh viên vào đây
                  </p>
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
          ))}
        </div>
      </div>
    );
  }

  // Show groups normal mode
  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={24} className="text-teal-600" strokeWidth={1.5} />
          <h3 className="text-lg font-bold text-purple-900">
            {groups.length} nhóm
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRegenerateGroups}
            disabled={isLoading}
            className="btn-secondary text-sm"
          >
            {isLoading ? "Đang chia lại..." : "Chia lại"}
          </button>
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="btn-secondary text-sm"
            title="Reset"
          >
            ↺ Reset
          </button>
          <button
            onClick={() => setIsFullscreen(true)}
            disabled={isLoading}
            className="btn-secondary text-sm"
            title="Fullscreen"
          >
            ⛶ Full
          </button>
          {onExit && (
            <button
              onClick={onExit}
              className="btn-secondary text-sm"
              title="Exit"
            >
              ✕ Exit
            </button>
          )}
        </div>
      </div>

      {/* Groups grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div
            key={group.groupNum}
            onDragOver={handleDragOver}
            onDrop={() => handleDropOnGroup(group.groupNum)}
            className="rounded-lg border-2 border-dashed border-purple-200 bg-purple-50 p-4 transition-colors hover:border-purple-400"
          >
            {/* Group header */}
            <h4 className="mb-3 text-sm font-semibold text-purple-900">
              Nhóm {group.groupNum} ({group.members.length})
            </h4>

            {/* Members */}
            <div className="space-y-2">
              {group.members.length === 0 ? (
                <p className="text-center text-xs text-purple-400">
                  Kéo sinh viên vào đây
                </p>
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
        ))}
      </div>
    </div>
  );
}
