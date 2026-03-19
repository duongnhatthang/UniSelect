// Headers with keyword variants — tests keyword .includes() matching
// Uses "Mã xét tuyển" instead of "Mã ngành"
// Uses "Điểm trúng tuyển" instead of "Điểm chuẩn"
// Uses "Tổ hợp xét tuyển" instead of "Tổ hợp"
export const RENAMED_HEADERS_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Điểm trúng tuyển 2024</title></head>
<body>
<table>
  <thead>
    <tr>
      <th>Mã xét tuyển</th>
      <th>Tên ngành</th>
      <th>Tổ hợp xét tuyển</th>
      <th>Điểm trúng tuyển</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>7340101</td><td>Quản trị kinh doanh</td><td>A00</td><td>24.50</td></tr>
    <tr><td>7480201</td><td>Công nghệ thông tin</td><td>A01</td><td>26.75</td></tr>
  </tbody>
</table>
</body>
</html>
`;
