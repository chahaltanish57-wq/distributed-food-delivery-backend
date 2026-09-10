import React from 'react';
import { 
  X, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowRight, 
  ShieldCheck, 
  MapPin, 
  Bike,
  Sparkles
} from 'lucide-react';

export default function CartDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onClearCart,
  onCheckout,
}) {
  if (!isOpen) return null;

  const items = cart?.items || [];
  const itemCount = cart?.totalItemCount || 0;
  const itemTotal = cart?.itemTotal || 0;
  const deliveryFee = cart?.deliveryFee || 0;
  const gst = cart?.gst || 0;
  const grandTotal = cart?.grandTotal || 0;
  const freeDeliveryThreshold = 500;
  const amountNeededForFreeDelivery = Math.max(0, freeDeliveryThreshold - itemTotal);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-50 rounded-xl text-orange-600">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Your Cart</h2>
                {cart?.restaurantName && (
                  <div className="flex items-center text-xs text-gray-500 space-x-1 mt-0.5">
                    <span className="font-semibold text-gray-700 truncate max-w-[180px]">
                      {cart.restaurantName}
                    </span>
                    {cart?.city && (
                      <>
                        <span>•</span>
                        <span className="flex items-center text-orange-600 font-medium">
                          <MapPin className="w-3 h-3 mr-0.5 inline" />
                          {cart.city}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-4">
                <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center text-orange-500 shadow-inner">
                  <ShoppingBag className="w-12 h-12 stroke-1" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Your cart is empty</h3>
                  <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                    Explore top rated kitchens in Noida & Dehradun and add your favorite dishes!
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="mt-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl shadow-lg shadow-orange-500/20 transition cursor-pointer text-sm"
                >
                  Browse Restaurants
                </button>
              </div>
            ) : (
              <>
                {/* Free Delivery Banner / Upsell */}
                {amountNeededForFreeDelivery > 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl flex items-center space-x-2 text-xs text-amber-800">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Add items worth <strong className="text-amber-900">₹{amountNeededForFreeDelivery.toFixed(0)}</strong> more to unlock <strong>FREE Delivery</strong>!
                    </span>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl flex items-center space-x-2 text-xs text-emerald-800">
                    <Bike className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-medium">
                      Yay! You've unlocked <strong className="text-emerald-900">FREE Delivery</strong> for this order!
                    </span>
                  </div>
                )}

                {/* Items List */}
                <div className="space-y-4 divide-y divide-gray-100">
                  {items.map((item) => (
                    <div key={item.menuItemId} className="pt-4 first:pt-0 flex items-center justify-between">
                      <div className="flex items-center space-x-3 max-w-[60%]">
                        {/* Veg / Non-Veg badge */}
                        <div className={`w-3.5 h-3.5 border shrink-0 rounded-sm flex items-center justify-center ${
                          item.isVegetarian ? 'border-emerald-600' : 'border-rose-600'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            item.isVegetarian ? 'bg-emerald-600' : 'bg-rose-600'
                          }`} />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-1">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            ₹{item.price} each
                          </p>
                        </div>
                      </div>

                      {/* Quantity Controller & Subtotal */}
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50/50 shadow-sm overflow-hidden">
                          <button
                            onClick={() => onUpdateQuantity(item.menuItemId, -1)}
                            className="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-50 transition"
                            title="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-xs font-bold text-gray-800 min-w-[20px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(item.menuItemId, 1)}
                            className="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-50 transition"
                            title="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-sm font-bold text-gray-900 min-w-[60px] text-right">
                          ₹{item.subtotal}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bill Breakdown */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2.5 text-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Bill Details
                  </h4>
                  
                  <div className="flex justify-between text-gray-600 text-xs">
                    <span>Item Total ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
                    <span className="font-semibold text-gray-800">₹{itemTotal}</span>
                  </div>

                  <div className="flex justify-between text-gray-600 text-xs">
                    <span className="flex items-center">
                      Delivery Partner Fee
                      {deliveryFee === 0 && (
                        <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">
                          FREE
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-gray-800">
                      {deliveryFee === 0 ? (
                        <span className="text-emerald-600">₹0</span>
                      ) : (
                        `₹${deliveryFee}`
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between text-gray-600 text-xs">
                    <span>Government Taxes & GST (5%)</span>
                    <span className="font-semibold text-gray-800">₹{gst}</span>
                  </div>

                  <div className="border-t border-gray-200 pt-2.5 flex justify-between items-center">
                    <div>
                      <span className="text-sm font-bold text-gray-900 block">TO PAY</span>
                      <span className="text-[10px] text-gray-400">Includes all applicable taxes</span>
                    </div>
                    <span className="text-base font-extrabold text-orange-600">
                      ₹{grandTotal}
                    </span>
                  </div>
                </div>

                {/* Trust badge */}
                <div className="flex items-center justify-center space-x-1.5 text-xs text-gray-400 py-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>100% Hygienic Food Delivery Guaranteed</span>
                </div>
              </>
            )}
          </div>

          {/* Sticky Checkout CTA Footer */}
          {items.length > 0 && (
            <div className="p-4 border-t border-gray-100 bg-white shadow-lg space-y-2">
              <button
                onClick={onCheckout}
                className="w-full py-3.5 px-4 bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 transition flex items-center justify-between cursor-pointer"
              >
                <div className="text-left leading-tight">
                  <span className="text-xs font-normal opacity-90 block">Grand Total</span>
                  <span className="text-base font-bold">₹{grandTotal}</span>
                </div>

                <div className="flex items-center space-x-1.5 text-sm font-bold">
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>

              <button
                onClick={onClearCart}
                className="w-full text-center text-xs text-gray-400 hover:text-rose-500 py-1 transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Cart</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
