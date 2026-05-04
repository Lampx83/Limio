"use client";

interface ManualStudentInputProps {
  value: string;
  onChange: (value: string) => void;
  studentCount: number;
}

export default function ManualStudentInput({
  value,
  onChange,
  studentCount,
}: ManualStudentInputProps) {
  return (
    <div className="space-y-2 border-t border-gray-200 pt-6 mt-6">
      <div className="flex items-center justify-between">
        <label className="label block font-medium">
          Nhập danh sách sinh viên (mỗi dòng một người)
        </label>
        <span className="text-xs text-muted">{studentCount} sinh viên</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input w-full h-40 resize-vertical"
        placeholder={`Nguyễn Văn A\nTrần Thị B\nPhạm Văn C`}
      />
      <p className="text-xs text-muted">
        Định dạng: Tên sinh viên, mỗi dòng một người
      </p>
    </div>
  );
}
