// Table with no score column match — causes 0-rows error in adapter
// Headers do not match any score keywords, so scoreIdx === -1
export const BROKEN_TABLE_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Danh sách ngành 2024</title></head>
<body>
<table>
  <thead>
    <tr>
      <th>Chuyên ngành</th>
      <th>Năm</th>
      <th>Ghi chú</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Công nghệ thông tin</td><td>2024</td><td>Đang cập nhật</td></tr>
    <tr><td>Quản trị kinh doanh</td><td>2024</td><td>Đang cập nhật</td></tr>
  </tbody>
</table>
</body>
</html>
`;
