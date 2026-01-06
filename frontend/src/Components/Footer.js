import { FaInstagram, FaFacebookF, FaWhatsapp } from 'react-icons/fa';
import  '../Assets/Footer.css'; 

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <p>© 2025 SmileBAR. All rights reserved.</p>
        <div className="social-icons">
          <a href="https://www.instagram.com/smile_bar23?igsh=MW40eDRieHhtaDB4OQ=="target="_blank" rel="noopener noreferrer">
            <FaInstagram />
          </a>
          <a href="https://www.facebook.com/share/16Aefi2qFZ/" target="_blank" rel="noopener noreferrer">
            <FaFacebookF />
          </a>
          <a href="https://wa.me/+96171926665" target="_blank" rel="noopener noreferrer">
            <FaWhatsapp />
          </a>
        </div>
      </div>
    </footer>
  )
}