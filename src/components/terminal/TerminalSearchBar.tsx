import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ISearchOptions, SearchAddon } from '@xterm/addon-search'
import { useI18n } from '@/context/I18nContext'
import '../../styles/terminal-search.css'

/** 终端内查找栏的搜索装饰 */
const SEARCH_DECORATIONS: ISearchOptions['decorations'] = {
  matchBackground: '#88888840',
  matchBorder: '#888888',
  matchOverviewRuler: '#888888',
  activeMatchBackground: '#ffcc0040',
  activeMatchBorder: '#ffcc00',
  activeMatchColorOverviewRuler: '#ffcc00',
}

/** 终端内查找栏的属性 */
interface TerminalSearchBarProps {
  /** 搜索添加器 */
  searchAddon: SearchAddon
  /** 是否打开 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
}

/** 终端内查找栏：覆盖在活跃终端上方，支持增量搜索与上/下跳转 */
export function TerminalSearchBar({ searchAddon, open, onClose }: TerminalSearchBarProps) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement | null>(null)  // 输入框引用
  const [query, setQuery] = useState('')  // 搜索查询
  const [caseSensitive, setCaseSensitive] = useState(false)  // 区分大小写
  const [wholeWord, setWholeWord] = useState(false)  // 全字匹配
  const [useRegex, setUseRegex] = useState(false)  // 使用正则表达式
  const searchFlagsRef = useRef({ caseSensitive, wholeWord, useRegex })  // 搜索标志引用
  const [regexInvalid, setRegexInvalid] = useState(false)  // 正则表达式无效
  const [resultIndex, setResultIndex] = useState(-1)  // 结果索引
  const [resultCount, setResultCount] = useState(0)  // 结果数量

  /** 搜索选项 */
  const searchOptions: ISearchOptions = useMemo(() => ({
    caseSensitive,
    wholeWord,
    regex: useRegex,
    incremental: true,
    decorations: SEARCH_DECORATIONS,
  }), [caseSensitive, wholeWord, useRegex])

  /** 运行搜索 */
  const runSearch = useCallback((direction: 'next' | 'prev', term: string) => {
    if (useRegex) {
      try { RegExp(term) } catch {
        searchAddon.clearDecorations()
        setRegexInvalid(true)
        setResultIndex(-1)
        setResultCount(0)
        return
      }
    }
    setRegexInvalid(false)

    const flags = { caseSensitive, wholeWord, useRegex }
    const flagsChanged =
      flags.caseSensitive !== searchFlagsRef.current.caseSensitive
      || flags.wholeWord !== searchFlagsRef.current.wholeWord
      || flags.useRegex !== searchFlagsRef.current.useRegex
    if (flagsChanged) {
      // xterm 在 term 不变时可能跳过重新高亮，需先清掉旧装饰
      searchAddon.clearDecorations()
      searchFlagsRef.current = flags
    }

    const found = direction === 'next'
      ? searchAddon.findNext(term, searchOptions)
      : searchAddon.findPrevious(term, searchOptions)

    if (!found) {
      searchAddon.clearDecorations()
      setResultIndex(-1)
      setResultCount(0)
    }
  }, [searchAddon, searchOptions, useRegex, caseSensitive, wholeWord])

  /** 运行查找 */
  const runFind = useCallback((direction: 'next' | 'prev') => {
    const term = query.trim()
    if (!term) return
    runSearch(direction, term)  // 运行搜索
  }, [query, runSearch])

  /** 关闭搜索 */
  const close = useCallback(() => {
    searchAddon.clearDecorations()  // 清除搜索装饰
    setQuery('')  // 清除搜索查询
    setRegexInvalid(false)  // 清除搜索装饰
    setResultIndex(-1)  // 清除结果索引
    setResultCount(0)  // 清除结果数量
    onClose()  // 关闭搜索
  }, [searchAddon, onClose])

  useEffect(() => {  // 如果搜索栏未打开，则不聚焦输入框
    if (!open) return
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {  // 如果搜索栏未打开，则不监听结果变化
    if (!open) return
    const sub = searchAddon.onDidChangeResults(({ resultIndex: idx, resultCount: count }) => {
      setResultIndex(idx)
      setResultCount(count)
    })
    return () => sub.dispose()
  }, [open, searchAddon])

  useEffect(() => () => { searchAddon.clearDecorations() }, [searchAddon])  // 清除搜索装饰

  useEffect(() => {  // 如果搜索栏未打开，则不运行搜索
    if (!open) return
    const term = query.trim()
    if (!term) {
      searchAddon.clearDecorations()
      setRegexInvalid(false)
      setResultIndex(-1)
      setResultCount(0)
      return
    }
    runSearch('next', term)
  }, [open, query, searchOptions, searchAddon, runSearch])

  if (!open) return null  // 如果搜索栏未打开，则不渲染

  const resultLabel = regexInvalid
    ? t('terminal.searchInvalidRegex')
    : resultCount > 0 && resultIndex >= 0
      ? t('terminal.searchResult', { current: resultIndex + 1, total: resultCount })
      : query.trim()
        ? t('terminal.searchNoResult')
        : ''

  return (
    <div className="terminal-search" role="search" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="search"
        className="terminal-search-input"
        value={query}
        placeholder={t('terminal.searchPh')}
        aria-label={t('terminal.searchAria')}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            close()
          } else if (e.key === 'Enter') {
            e.preventDefault()
            runFind(e.shiftKey ? 'prev' : 'next')
          }
        }}
      />
      <span className="terminal-search-status" aria-live="polite">{resultLabel}</span>
      <label className="terminal-search-toggle" title={t('terminal.searchCaseSensitive')}>
        <input
          type="checkbox"
          checked={caseSensitive}
          onChange={(e) => setCaseSensitive(e.target.checked)}
        />
        Aa
      </label>
      <label className="terminal-search-toggle" title={t('terminal.searchWholeWord')}>
        <input
          type="checkbox"
          checked={wholeWord}
          onChange={(e) => setWholeWord(e.target.checked)}
        />
        W
      </label>
      <label className="terminal-search-toggle" title={t('terminal.searchRegex')}>
        <input
          type="checkbox"
          checked={useRegex}
          onChange={(e) => setUseRegex(e.target.checked)}
        />
        .*
      </label>
      <button type="button" className="terminal-search-btn" title={t('terminal.searchPrev')} onClick={() => runFind('prev')}>↑</button>
      <button type="button" className="terminal-search-btn" title={t('terminal.searchNext')} onClick={() => runFind('next')}>↓</button>
      <button type="button" className="terminal-search-btn terminal-search-close" title={t('terminal.searchClose')} onClick={close}>×</button>
    </div>
  )
}
