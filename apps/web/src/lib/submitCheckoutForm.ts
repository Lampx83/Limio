/**
 * Gửi form POST tới cổng thanh toán (cổng SePay đòi form `application/x-www-form-urlencoded`, không phải JSON). Giữ ĐÚNG
 * thứ tự các trường như máy chủ trả về: chữ ký được tính theo thứ tự đó.
 */
export function submitCheckoutForm(url: string, fields: ReadonlyArray<readonly [string, string]>): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  form.style.display = "none";
  for (const [name, value] of fields) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
