/** 
 * 读满目录项（readEntries 单次最多约 100 条，须循环）
 * @param reader 目录读取器
 * @returns 目录项列表
 */
export function readAllDirEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    const all: FileSystemEntry[] = []
    const step = () => {
      reader.readEntries((batch) => {
        if (!batch.length) resolve(all)
        else {
          all.push(...batch)
          step()
        }
      })
    }
    step()
  })
}
