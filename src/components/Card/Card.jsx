/* eslint-disable no-unused-vars */
import React from 'react'
import './styles.css'

const Card = ( {balance, setBalance} ) => {
  return (
    <div className="card">
      <div className="card-block">
        <p>CRYPTO-FINANCE</p>
        <button
          onMouseEnter={() => console.log("---enter")}
          onClick={() => setBalance(balance = balance + 100)}
        >
          Add money
        </button>
      </div>

      <div className="card-block">
        <p>Yurii</p>
        <p>{balance} $</p>
      </div>
    </div>
  )
}

export default Card