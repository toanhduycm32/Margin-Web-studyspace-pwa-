Add-Type -AssemblyName System.Drawing

$output = Join-Path $PSScriptRoot '..\public'
foreach ($entry in @(@{ Size = 192; Name = 'icon-192.png' }, @{ Size = 512; Name = 'icon-512.png' }, @{ Size = 180; Name = 'apple-touch-icon.png' })) {
  $size = $entry.Size
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.ScaleTransform($size / 512.0, $size / 512.0)
  $green = [System.Drawing.ColorTranslator]::FromHtml('#173d35')
  $paper = [System.Drawing.ColorTranslator]::FromHtml('#f7f4eb')
  $accent = [System.Drawing.ColorTranslator]::FromHtml('#d8e8bf')
  $graphics.Clear($green)
  $pageBrush = [System.Drawing.SolidBrush]::new($paper)
  $accentBrush = [System.Drawing.SolidBrush]::new($accent)
  $linePen = [System.Drawing.Pen]::new($green, 15)
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.FillRectangle($pageBrush, 126, 117, 253, 280)
  $graphics.FillRectangle($accentBrush, 126, 343, 96, 54)
  $graphics.DrawLine($linePen, 178, 183, 326, 183)
  $graphics.DrawLine($linePen, 178, 229, 326, 229)
  $graphics.DrawLine($linePen, 178, 275, 292, 275)
  $bitmap.Save((Join-Path $output $entry.Name), [System.Drawing.Imaging.ImageFormat]::Png)
  $linePen.Dispose(); $accentBrush.Dispose(); $pageBrush.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
