import type { ReactNode } from 'react'

/** 表单行组件属性 */
export interface FormRowProps {
  /** 标签 */
  label: string
  /** 子组件 */
  children: ReactNode
  /** 标题 */
  title?: string
  /** 标签与控件顶部对齐（多行控件如 textarea） */
  topAlign?: boolean
}

/** 连接对话框中的标签 + 控件行布局 */
export default function FormRow({ label, children, title, topAlign }: FormRowProps) {
  return (
    <div className={`form-row${topAlign ? ' form-row-top-align' : ''}`}>
      <label className="form-label" title={title}>{label}</label>
      <div className="form-control">{children}</div>
    </div>
  )
}
