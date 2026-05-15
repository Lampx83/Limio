import { redirect } from "next/navigation";

// /exam without a code → bounce to the friendly landing URL /thi.
export default function ExamRootRedirect() {
  redirect("/thi");
}
