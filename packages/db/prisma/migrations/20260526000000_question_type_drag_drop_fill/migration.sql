-- Drag-drop fill: học viên kéo token từ pool thả vào các ô [[N]] trong prompt.
-- Cùng bảng QuizQuestion với fill_in/mcq/… — chỉ thêm 1 enum value.
ALTER TYPE "QuestionType" ADD VALUE 'drag_drop_fill';
