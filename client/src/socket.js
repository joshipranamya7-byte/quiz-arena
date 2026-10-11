import { io } from 'socket.io-client'

export const socket = io(import.meta.env.VITE_SERVER_URL || undefined)

export const emit = (event, data) =>
  new Promise((resolve, reject) => {
    socket.timeout(8000).emit(event, data, (err, res) => {
      if (err) return reject(new Error('Server not responding'))
      if (res?.error) return reject(new Error(res.error))
      resolve(res)
    })
  })
