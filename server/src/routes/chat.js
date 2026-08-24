import { Router } from 'express'
import supabase, { supabaseStorage } from '../db/supabase.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100
    const before = req.query.before

    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data, error } = await query
    if (error) throw error

    res.json(data.reverse())
  } catch (err) {
    console.error('Get messages error:', err)
    res.status(500).json({ error: 'Failed to load messages' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { content } = req.body
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' })
    }

    const user = req.user || {}
    const message = {
      user_id: user.id || null,
      user_name: user.full_name || user.username || 'Unknown',
      content: content.trim(),
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([message])
      .select()
      .single()

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error('Send message error:', err)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

router.delete('/all', async (req, res) => {
  try {
    const user = req.user || {}
    if (user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Only managers can delete all messages' })
    }
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('id')
    if (fetchError) throw fetchError
    if (!messages || messages.length === 0) {
      return res.json({ message: 'No messages to delete', count: 0 })
    }
    const ids = messages.map(m => m.id)
    const { error } = await supabaseStorage
      .from('messages')
      .delete()
      .in('id', ids)
    if (error) throw error
    res.json({ message: 'All messages deleted', count: ids.length })
  } catch (err) {
    console.error('Delete all messages error:', err)
    res.status(500).json({ error: 'Failed to delete all messages' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const user = req.user || {}
    if (user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Only managers can delete messages' })
    }
    const { id } = req.params
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if (error) throw error
    res.json({ message: 'Message deleted' })
  } catch (err) {
    console.error('Delete message error:', err)
    res.status(500).json({ error: 'Failed to delete message' })
  }
})

export default router
