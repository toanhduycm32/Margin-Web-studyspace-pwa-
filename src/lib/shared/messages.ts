export function vietnameseMessage(message: string, status?: number): string {
  if (/[ăâđêôơưĂÂĐÊÔƠƯạảấầẩẫậắằẳẵặẹẻẽếềểễệỉĩịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/u.test(message)) return message;
  const rules: Array<[RegExp, string]> = [
    [/origin/i, "Địa chỉ truy cập chưa được chấp nhận. Mở Margin bằng địa chỉ chính thức rồi thử lại."],
    [/Connect your Google|Session is invalid|permission expired|authorization failed/i, "Phiên Google đã hết hạn. Kết nối lại tài khoản để tiếp tục."],
    [/not authorized|access list|not allowed/i, "Tài khoản này chưa được cấp quyền truy cập."],
    [/integrity|signature/i, "Phần xử lý đã lưu không vượt qua kiểm tra toàn vẹn. Bản hiện hành vẫn được giữ; tải lại trang để thử lại."],
    [/PDF changed/i, "PDF đã thay đổi trong Drive. Mở lại tài liệu trước khi tạo học liệu."],
    [/quota|daily|allowance/i, "Đã đạt hạn mức AI hôm nay. Phần hoàn tất đã lưu; bạn có thể tiếp tục khi hạn mức được làm mới."],
    [/already active|busy for this account|account is still running/i, "Tài khoản đang có một tác vụ AI khác. Đợi tác vụ đó hoàn tất rồi thử lại."],
    [/busy|capacity|saturat/i, "Dịch vụ AI đang bận. Phần đã xử lý vẫn được giữ; hãy thử lại sau ít phút."],
    [/rate limit/i, "Nhà cung cấp AI đang giới hạn yêu cầu. Hãy đợi một lúc rồi tiếp tục."],
    [/too long|timeout/i, "Bước xử lý mất nhiều thời gian. Thử lại để tiếp tục từ phần đã lưu."],
    [/stopped|abort|cancel/i, "Đã dừng xử lý. Bản hiện hành vẫn được giữ."],
    [/not configured|configuration|missing.*key|API_KEY|SESSION_SECRET/i, "Ứng dụng chưa hoàn tất kết nối dịch vụ. Vui lòng liên hệ người quản lý."],
    [/credits/i, "Dịch vụ AI đã hết hạn mức sử dụng. Bản hiện hành vẫn được giữ."],
    [/NVIDIA rejected/i, "Chưa truy cập được mô hình AI đã cấu hình. Vui lòng liên hệ người quản lý."],
    [/ambiguous|unsupported answers|source-backed quiz|assessment review|Question generation|malformed structured|incomplete.*assessment/i, "Một số câu hỏi chưa đạt yêu cầu về đáp án hoặc chứng cứ. Thử lại để tạo lại phần này; bản cũ vẫn được giữ."],
    [/digest|summary/i, "Chưa tạo được bản tóm tắt đạt yêu cầu. Thử lại để tiếp tục từ phần đã lưu."],
    [/no readable|too little text|OCR/i, "Chưa đọc được đủ văn bản từ PDF. Tài liệu scan cần nhận dạng chữ trước khi tạo học liệu."],
    [/byte range|PDF structure|PDF.*render|PDF.*download/i, "Chưa tải đầy đủ dữ liệu PDF. Kiểm tra kết nối rồi mở lại tài liệu."],
    [/file.*not found|not in your library|resource not found/i, "Tài liệu hoặc học liệu không còn khả dụng trong tài khoản này. Mở lại thư viện để kiểm tra."],
    [/access.*denied/i, "Google Drive chưa cấp quyền mở tài liệu này. Chọn lại PDF từ tài khoản của bạn."],
    [/too large|250 MB|page count|too many|exceeds/i, "Tài liệu vượt sức chứa của lượt xử lý này. Chưa lưu kết quả thiếu; học liệu hiện hành vẫn được giữ."],
    [/answer every|Answer question|number of choices/i, "Hãy trả lời đủ các câu và chọn đúng số đáp án yêu cầu trước khi nộp bài."],
    [/damaged|incomplete|inconsistent/i, "Dữ liệu chưa đầy đủ hoặc không nhất quán. Tải lại trang và thử lại; bản hiện hành vẫn được giữ."],
    [/Google Picker/i, "Chưa mở được trình chọn Google Drive. Kiểm tra kết nối và thử lại."],
  ];
  for (const [pattern, translation] of rules) if (pattern.test(message)) return translation;
  if (status === 401) return "Phiên Google đã hết hạn. Kết nối lại tài khoản để tiếp tục.";
  return "Chưa xác nhận được kết quả. Mở lại học liệu để kiểm tra trạng thái lưu trước khi thử lại.";
}
