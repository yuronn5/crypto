import Header from './components/Header/Header.jsx'
import Main from './pages/Main/Main.jsx'
import { useState } from 'react'


function App() {
  const [balance, setBalance] = useState(10000);

  return (
    <div>
      <Header />
      <Main balance={balance} setBalance={setBalance} />
    </div>
  )
}

export default App
