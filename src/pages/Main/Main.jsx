/* eslint-disable react/prop-types */
// eslint-disable-next-line no-unused-vars
import React from 'react'
import styles from './styles.module.css'
import Card from '../../components/Card/Card.jsx'

const Main = ( {balance, setBalance} ) => {
  return (
    <main className={styles.main}>

      <Card balance={balance} setBalance={setBalance} />
    </main>
  )
}

export default Main