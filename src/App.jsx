import { useEffect, useState } from 'react'
import Hello from './Hello'
import Read from './Read'
import Write from './Write'
import Mirror from './Mirror'

export default function App () {
  const [enterAction, setEnterAction] = useState({})
  const [route, setRoute] = useState('')

  useEffect(() => {
    if (window.utools) {
      window.utools.onPluginEnter((action) => {
        setRoute(action.code)
        setEnterAction(action)
      })
      window.utools.onPluginOut((isKill) => {
        setRoute('')
      })
    } else {
      setRoute('mirror')
    }
  }, [])

  if (route === 'hello') {
    return <Hello enterAction={enterAction} />
  }

  if (route === 'read') {
    return <Read enterAction={enterAction} />
  }

  if (route === 'write') {
    return <Write enterAction={enterAction} />
  }

  if (route === 'mirror') {
    return <Mirror enterAction={enterAction} />
  }

  return false
}
