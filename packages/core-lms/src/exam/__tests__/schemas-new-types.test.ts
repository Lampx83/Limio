import { describe, expect, it } from "vitest";
import {
  configSchemaForType,
  DragDropFillConfig,
  MatchingConfig,
  NumericalConfig,
  OrderingConfig,
} from "../schemas";

describe("OrderingConfig — Sắp xếp thứ tự", () => {
  const valid = {
    items: [
      { id: "s1", label: "Bước 1" },
      { id: "s2", label: "Bước 2" },
      { id: "s3", label: "Bước 3" },
    ],
  };

  it("hợp lệ: thứ tự trong mảng items CHÍNH LÀ thứ tự đúng", () => {
    expect(OrderingConfig.safeParse(valid).success).toBe(true);
  });

  it("dưới 2 bước: từ chối", () => {
    expect(OrderingConfig.safeParse({ items: [valid.items[0]] }).success).toBe(false);
  });

  it("id trùng nhau: từ chối", () => {
    const dup = { items: [{ id: "s1", label: "A" }, { id: "s1", label: "B" }] };
    expect(OrderingConfig.safeParse(dup).success).toBe(false);
  });

  it("giữ explanation", () => {
    const r = OrderingConfig.safeParse({ ...valid, explanation: "Vì..." });
    expect(r.success && r.data.explanation).toBe("Vì...");
  });

  it("configSchemaForType('ordering') dùng đúng OrderingConfig", () => {
    expect(configSchemaForType("ordering").safeParse(valid).success).toBe(true);
  });
});

describe("MatchingConfig — Ghép đôi", () => {
  const valid = {
    pairs: [
      { id: "p1", left: "Hà Nội", right: "Việt Nam" },
      { id: "p2", left: "Bangkok", right: "Thái Lan" },
    ],
  };

  it("hợp lệ", () => {
    expect(MatchingConfig.safeParse(valid).success).toBe(true);
  });

  it("dưới 2 cặp: từ chối", () => {
    expect(MatchingConfig.safeParse({ pairs: [valid.pairs[0]] }).success).toBe(false);
  });

  it("id cặp trùng nhau: từ chối", () => {
    const dup = {
      pairs: [
        { id: "p1", left: "A", right: "X" },
        { id: "p1", left: "B", right: "Y" },
      ],
    };
    expect(MatchingConfig.safeParse(dup).success).toBe(false);
  });

  it("thiếu left hoặc right: từ chối", () => {
    const bad = { pairs: [{ id: "p1", left: "A" }, { id: "p2", left: "B", right: "Y" }] };
    expect(MatchingConfig.safeParse(bad).success).toBe(false);
  });

  it("configSchemaForType('matching') dùng đúng MatchingConfig — thay cho matching_heading (P1) đã bỏ", () => {
    expect(configSchemaForType("matching").safeParse(valid).success).toBe(true);
  });
});

describe("NumericalConfig — Số học", () => {
  it("hợp lệ, tolerance mặc định 0 nếu không truyền", () => {
    const r = NumericalConfig.safeParse({ expected: 42 });
    expect(r.success).toBe(true);
    expect(r.success && r.data.tolerance).toBe(0);
  });

  it("tolerance âm: từ chối", () => {
    expect(NumericalConfig.safeParse({ expected: 1, tolerance: -1 }).success).toBe(false);
  });

  it("thiếu expected: từ chối", () => {
    expect(NumericalConfig.safeParse({ tolerance: 1 }).success).toBe(false);
  });

  it("expected không phải số: từ chối", () => {
    expect(NumericalConfig.safeParse({ expected: "42" }).success).toBe(false);
  });

  it("configSchemaForType('numerical') dùng đúng NumericalConfig", () => {
    expect(configSchemaForType("numerical").safeParse({ expected: 3.14, tolerance: 0.01 }).success).toBe(true);
  });
});

describe("DragDropFillConfig — Kéo-thả điền từ", () => {
  const valid = {
    tokens: [
      { id: "t1", label: "Hà Nội", blankIndex: 1 },
      { id: "t2", label: "sông Hồng", blankIndex: 2 },
      { id: "t3", label: "Paris", blankIndex: null }, // mồi nhử — không thuộc chỗ trống nào
    ],
  };

  it("hợp lệ: có ≥1 token thật (blankIndex khác null), cho phép mồi nhử", () => {
    expect(DragDropFillConfig.safeParse(valid).success).toBe(true);
  });

  it("mọi token đều là mồi nhử (không có blankIndex nào): từ chối — không có chỗ trống thật", () => {
    const allDistractors = { tokens: [{ id: "t1", label: "x", blankIndex: null }] };
    expect(DragDropFillConfig.safeParse(allDistractors).success).toBe(false);
  });

  it("id token trùng nhau: từ chối", () => {
    const dup = { tokens: [{ id: "t1", label: "a", blankIndex: 1 }, { id: "t1", label: "b", blankIndex: 2 }] };
    expect(DragDropFillConfig.safeParse(dup).success).toBe(false);
  });

  it("blankIndex phải là số nguyên dương hoặc null — 0 bị từ chối", () => {
    const zero = { tokens: [{ id: "t1", label: "a", blankIndex: 0 }] };
    expect(DragDropFillConfig.safeParse(zero).success).toBe(false);
  });

  it("configSchemaForType('drag_drop_fill') dùng đúng DragDropFillConfig", () => {
    expect(configSchemaForType("drag_drop_fill").safeParse(valid).success).toBe(true);
  });
});

describe("configSchemaForType — loại chưa biết vẫn bị từ chối (không mở cửa ngoài ý muốn)", () => {
  it("'matching_heading' (tên cũ, đã đổi thành 'matching') không còn hợp lệ", () => {
    expect(configSchemaForType("matching_heading").safeParse({}).success).toBe(false);
  });
  it("loại lạ bất kỳ", () => {
    expect(configSchemaForType("hoi_dap_mo").safeParse({}).success).toBe(false);
  });
});
