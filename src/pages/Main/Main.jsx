/* eslint-disable react/prop-types */
// eslint-disable-next-line no-unused-vars
import React from 'react'
import styles from './styles.module.css'
import Card from '../../components/Card/Card.jsx'
import CoinsList from '../../components/CoinsList/CoinsList.jsx'

const Main = ( {balance, setBalance, coins} ) => {
  return (
    <main className={styles.main}>

      <Card balance={balance} setBalance={setBalance} />

      {coins.length > 0 ? <CoinsList coins={coins} /> : <div>...Loading</div>}
    </main>
  )
}

export default Main