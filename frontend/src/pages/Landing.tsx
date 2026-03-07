import { Link } from 'react-router-dom'
import './Landing.css'

export default function Landing() {
  return (
    <div className="landing">
      <h1 className="landing-slogan">Давайте сделаем нашу жизнь легче вместе!</h1>
      <div className="landing-actions">
        <Link to="/appeal" className="btn btn-primary btn-large">Подайте жалобу</Link>
        <div className="landing-secondary">
          <Link to="/register" className="btn">Регистрация</Link>
          <Link to="/login" className="btn">Войти</Link>
        </div>
      </div>
    </div>
  )
}
