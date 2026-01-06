import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./Components/Navbar";
import Footer from "./Components/Footer";
import Home from "./pages/Home";
import Products from "./pages/Products";
import Contact from "./pages/Contact";
import { CartProvider } from "./context/CartContext";
import Cart from "./pages/Cart";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Checkout from "./pages/Checkout";
import MyOrders from "./pages/MyOrders";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminRegister from "./pages/admin/AdminRegister";
import ProtectedAdminRoute from "./admin/ProtectedAdminRoute";
import ProtectedClientRoute from "./client/ProtectedClientRoute";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function AppShell() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <>
      <Navbar />
      <div style={{ minHeight: "80vh", paddingTop: "76px" }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/cart" element={<Cart />} />
          <Route
            path="/checkout"
            element={
              <ProtectedClientRoute>
                <Checkout />
              </ProtectedClientRoute>
            }
          />
          <Route
            path="/my-orders"
            element={
              <ProtectedClientRoute>
                <MyOrders />
              </ProtectedClientRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/register" element={<AdminRegister />} />
          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <AdminDashboard />
              </ProtectedAdminRoute>
            }
          />
        </Routes>
      </div>
      {!isAdminRoute ? <Footer /> : null}
    </>
  );
}

function App() {
  return (
    <CartProvider>
      <Router>
        <ToastContainer position="top-right" autoClose={2500} newestOnTop />
        <AppShell />
      </Router>
    </CartProvider>
  );
}

export default App;
