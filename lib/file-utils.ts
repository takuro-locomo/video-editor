/**
 * ブラウザが選択されたファイルを実際に読み取れるか確認する。
 * Google Drive等のクラウド同期フォルダの「オンラインのみ」ファイルや、
 * 選択後に移動・削除されたファイルは読み取りに失敗し、
 * アップロード時に「Failed to fetch」になるため事前に検出する。
 */
export async function checkFileReadable(file: File): Promise<string | null> {
  try {
    await file.slice(0, 64 * 1024).arrayBuffer()
    return null
  } catch {
    return (
      `「${file.name}」を読み取れません。` +
      'Google Drive などクラウド上のファイルの場合は、一度デスクトップ等にコピーして' +
      '完全にダウンロードされた状態で選び直してください。'
    )
  }
}
