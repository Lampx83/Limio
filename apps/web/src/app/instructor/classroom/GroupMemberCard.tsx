"use client";

interface GroupMemberCardProps {
  userId: string;
  name: string;
  skillScore?: number;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function GroupMemberCard({
  userId,
  name,
  skillScore,
  draggable = false,
  onDragStart,
  onDragEnd,
}: GroupMemberCardProps) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`
        flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3
        transition-all ${draggable ? "cursor-move hover:border-purple-300 hover:shadow-sm" : ""}
      `}
      data-user-id={userId}
    >
      {/* Avatar placeholder */}
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-blue-400 text-xs font-bold text-white">
        {name.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{name}</p>
      </div>

      {/* Skill badge */}
      {skillScore !== undefined && (
        <div className="flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1">
          <span className="text-xs font-semibold text-purple-700">
            {skillScore}%
          </span>
        </div>
      )}
    </div>
  );
}
