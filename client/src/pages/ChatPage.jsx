import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import api from '../lib/api'
import supabase from '../lib/supabase'
import { Send, Trash2, MessageCircle, Users, Wifi, WifiOff } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

export default function ChatPage() {
  const { t } = useAppStore()
  const { currentUser } = useUserStore()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
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
      setLoading(true)
      const res = await api.get('/chat?limit=200')
      setMessages(res.data)
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Real-time subscription with deduplication
  useEffect(() => {
    const channel = supabase
      .channel('chat-page')
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
  }, [])

  // Polling fallback — fetches new messages every 10s in case real-time misses them
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await api.get('/chat?limit=200')
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
          return [...prev, ...newMsgs]
        })
      } catch { /* silent */ }
    }

    pollRef.current = setInterval(poll, 10000)
    return () => clearInterval(pollRef.current)
  }, [])

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

  const formatDate = (date) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return t('chat.today') || 'Today'
    if (d.toDateString() === yesterday.toDateString()) return t('chat.yesterday') || 'Yesterday'
    return d.toLocaleDateString()
  }

  const groupMessagesByDate = (msgs) => {
    const groups = []
    let currentDate = null

    for (const msg of msgs) {
      const msgDate = new Date(msg.created_at).toDateString()
      if (msgDate !== currentDate) {
        currentDate = msgDate
        groups.push({ date: msg.created_at, messages: [] })
      }
      groups[groups.length - 1].messages.push(msg)
    }
    return groups
  }

  const messageGroups = groupMessagesByDate(messages)

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] sm:h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl border border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">{t('chat.title') || 'Team Chat'}</h2>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {t('chat.allMembers') || 'All team members'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentUser?.role === 'MANAGER' && messages.length > 0 && (
            <button
              onClick={() => setDeleteAllOpen(true)}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
              title={t('chat.deleteAll') || 'Delete all messages'}
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
          {connected ? (
            <span className="text-[10px] sm:text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              <span className="hidden sm:inline">{t('chat.online') || 'Online'}</span>
            </span>
          ) : (
            <span className="text-[10px] sm:text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded-full flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              <span className="hidden sm:inline">{t('chat.offline') || 'Offline'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 border-x border-gray-200 dark:border-gray-700 p-5 sm:p-6 space-y-3 sm:space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageCircle className="w-12 h-12 sm:w-16 sm:h-16 mb-4 opacity-30" />
            <p className="text-base sm:text-lg font-medium">{t('chat.noMessages') || 'No messages yet'}</p>
            <p className="text-xs sm:text-sm">{t('chat.startConversation') || 'Start a conversation with your team'}</p>
          </div>
        ) : (
          messageGroups.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-3 my-3 sm:my-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                <span className="text-[10px] sm:text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-1 rounded-full">
                  {formatDate(group.date)}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
              </div>

              <div className="space-y-2 sm:space-y-3">
                {group.messages.map((msg) => {
                  const isOwn = msg.user_id === currentUser?.id
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] sm:max-w-[70%] ${isOwn ? 'order-2' : ''}`}>
                        {!isOwn && (
                          <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 px-1">
                            {msg.user_name}
                          </p>
                        )}
                        <div className={`group relative px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl ${
                          isOwn
                            ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-br-md'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                        }`}>
                          <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <p className={`text-[9px] sm:text-[10px] mt-1 ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
                            {formatTime(msg.created_at)}
                          </p>
                          {currentUser?.role === 'MANAGER' && (
                            <button
                              onClick={() => setDeleteTarget(msg.id)}
                              className={`absolute top-1 ${isOwn ? '-left-7 sm:-left-8' : '-right-7 sm:-right-8'} opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all`}
                            >
                              <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />
                            </button>
                          )}
                        </div>
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
      <form onSubmit={sendMessage} className="bg-white dark:bg-gray-800 rounded-b-2xl border border-gray-200 dark:border-gray-700 px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('chat.placeholder') || 'Type a message...'}
            disabled={sending}
            className="flex-1 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white flex items-center justify-center hover:shadow-lg hover:shadow-primary-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
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
    </div>
  )
}
