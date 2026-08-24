import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import api from '../lib/api'
import supabase from '../lib/supabase'
import { MessageCircle, Send, Trash2, X, Minimize2, Wifi, WifiOff } from 'lucide-react'
import ConfirmModal from './ConfirmModal'

export default function ChatWidget() {
  const { t } = useAppStore()
  const { currentUser } = useUserStore()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [connected, setConnected] = useState(false)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const sentIdsRef = useRef(new Set())
  const pollRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const loadMessages = async () => {
    try {
      const res = await api.get('/chat?limit=100')
      setMessages(res.data)
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [])

  useEffect(() => {
    if (open) {
      scrollToBottom()
      setUnreadCount(0)
    }
  }, [open, messages, scrollToBottom])

  // Real-time subscription with deduplication
  useEffect(() => {
    const channel = supabase
      .channel('chat-widget')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const newMsg = payload.new
        if (sentIdsRef.current.has(newMsg.id)) {
          sentIdsRef.current.delete(newMsg.id)
          return
        }
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        if (!open && newMsg.user_id !== currentUser?.id) {
          setUnreadCount(prev => prev + 1)
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [open, currentUser?.id])

  // Polling fallback — fetches new messages every 10s in case real-time misses them
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await api.get('/chat?limit=100')
        const serverMsgs = res.data
        setMessages(prev => {
          const prevIds = new Set(prev.map(m => m.id))
          const newMsgs = serverMsgs.filter(m => !prevIds.has(m.id))
          if (newMsgs.length === 0) {
            const serverIds = new Set(serverMsgs.map(m => m.id))
            const removed = prev.filter(m => !serverIds.has(m.id))
            if (removed.length === 0) return prev
            return prev.filter(m => serverIds.has(m.id))
          }
          if (!open) {
            const ownId = currentUser?.id
            const freshUnread = newMsgs.filter(m => m.user_id !== ownId).length
            if (freshUnread > 0) setUnreadCount(prev => prev + freshUnread)
          }
          return [...prev, ...newMsgs]
        })
      } catch { /* silent */ }
    }

    pollRef.current = setInterval(poll, 10000)
    return () => clearInterval(pollRef.current)
  }, [open, currentUser?.id])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    const content = newMessage.trim()
    setNewMessage('')

    try {
      setSending(true)
      const res = await api.post('/chat', { content })
      const sentMsg = res.data
      sentIdsRef.current.add(sentMsg.id)
      setMessages(prev => [...prev, sentMsg])
      inputRef.current?.focus()
    } catch (err) {
      console.error('Failed to send message:', err)
      setNewMessage(content)
    } finally {
      setSending(false)
    }
  }

  const deleteAllMessages = async () => {
    setDeleting(true)
    try {
      await api.delete('/chat/all')
      setMessages([])
      setDeleteAllOpen(false)
    } catch (err) {
      console.error('Failed to delete all messages:', err)
    } finally {
      setDeleting(false)
    }
  }

  const deleteMessage = async (id) => {
    setDeleting(true)
    try {
      await api.delete(`/chat/${id}`)
      setMessages(prev => prev.filter(m => m.id !== id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete message:', err)
    } finally {
      setDeleting(false)
    }
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const groupMessagesByDate = (msgs) => {
    const groups = []
    let currentDate = null

    for (const msg of msgs) {
      const msgDate = new Date(msg.created_at).toDateString()
      if (msgDate !== currentDate) {
        currentDate = msgDate
        const d = new Date(msg.created_at)
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        let label = d.toLocaleDateString()
        if (d.toDateString() === today.toDateString()) label = t('chat.today') || 'Today'
        else if (d.toDateString() === yesterday.toDateString()) label = t('chat.yesterday') || 'Yesterday'
        groups.push({ date: label, messages: [] })
      }
      groups[groups.length - 1].messages.push(msg)
    }
    return groups
  }

  const messageGroups = groupMessagesByDate(messages)

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-5 end-5 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 ${
          open
            ? 'bg-gray-600 hover:bg-gray-700'
            : 'bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-primary-500/40'
        }`}
      >
        {open ? (
          <Minimize2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        ) : (
          <>
            <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-20 end-3 start-3 sm:start-auto sm:w-80 z-50 h-[60vh] sm:h-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <span className="font-bold text-white text-xs sm:text-sm">{t('chat.title') || 'Team Chat'}</span>
              {connected ? (
                <Wifi className="w-3 h-3 text-green-200" />
              ) : (
                <WifiOff className="w-3 h-3 text-red-200" />
              )}
            </div>
            <div className="flex items-center gap-1">
              {currentUser?.role === 'MANAGER' && messages.length > 0 && (
                <button onClick={() => setDeleteAllOpen(true)} className="p-1 rounded-lg hover:bg-white/20 transition-colors" title={t('chat.deleteAll') || 'Delete all messages'}>
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 sm:space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 mb-2 opacity-30" />
                <p className="text-[10px] sm:text-xs">{t('chat.noMessages') || 'No messages yet'}</p>
              </div>
            ) : (
              messageGroups.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                    <span className="text-[9px] sm:text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full">{group.date}</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    {group.messages.map((msg) => {
                      const isOwn = msg.user_id === currentUser?.id
                      return (
                        <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] group relative`}>
                            {!isOwn && (
                              <p className="text-[9px] sm:text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 px-1">
                                {msg.user_name}
                              </p>
                            )}
                            <div className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs leading-relaxed ${
                              isOwn
                                ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-br-sm'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm'
                            }`}>
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                              <p className={`text-[8px] sm:text-[9px] mt-0.5 ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>
                                {formatTime(msg.created_at)}
                              </p>
                            </div>
                            {currentUser?.role === 'MANAGER' && (
                              <button
                                onClick={() => setDeleteTarget(msg.id)}
                                className={`absolute top-0 ${isOwn ? '-left-5 sm:-left-6' : '-right-5 sm:-right-6'} opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all`}
                              >
                                <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-400" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="border-t border-gray-200 dark:border-gray-700 p-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={t('chat.placeholder') || 'Type a message...'}
                disabled={sending}
                className="flex-1 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary-500 hover:bg-primary-600 text-white flex items-center justify-center disabled:opacity-50 transition-colors flex-shrink-0"
              >
                <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}
      <ConfirmModal
        open={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={deleteAllMessages}
        title={t('chat.deleteAllTitle') || 'Delete All Messages'}
        message={t('chat.deleteAllConfirm') || 'Are you sure you want to delete ALL messages? This action cannot be undone.'}
        type="danger"
        confirmText={t('chat.deleteAll') || 'Delete All'}
        cancelText={t('common.cancel') || 'Cancel'}
        loading={deleting}
      />
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMessage(deleteTarget)}
        title={t('chat.deleteTitle') || 'Delete Message'}
        message={t('chat.deleteConfirm') || 'Are you sure you want to delete this message?'}
        type="danger"
        confirmText={t('common.delete') || 'Delete'}
        cancelText={t('common.cancel') || 'Cancel'}
        loading={deleting}
      />
    </>
  )
}
