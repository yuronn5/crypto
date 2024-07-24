/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import React from 'react'
import './styles.css'
import {WithEuBalance} from '../../helpers/hoc/withEuBalance.jsx';

const Card = ( {balance, setBalance, euBalance} ) => {
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

export default WithEuBalance(Card);