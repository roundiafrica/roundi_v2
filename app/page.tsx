"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import {
  Search,
  Menu,
  Settings,
  Bell,
  MapPin,
  Route,
  Users,
  Package,
  Clock,
  Navigation,
  Layers,
  ZoomIn,
  ZoomOut,
  Locate,
  Phone,
  MessageCircle,
  MoreVertical,
  Filter,
  Calendar,
  Truck,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

// Dynamic import for the map component to avoid SSR issues
const MapComponent = dynamic(() => import("./components/map-component"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-white animate-pulse rounded-lg border" />,
})

// Mock delivery data
const mockDeliveries = [
  {
    id: 1,
    farmerName: "John Kamau",
    location: "Kiambu",
    coordinates: [-1.1744, 36.835],
    produce: "Tomatoes, Carrots",
    dropTime: "09:30 AM",
    status: "pending",
    phone: "+254 712 345 678",
    estimatedValue: "KSh 2,500",
    weight: "25kg",
  },
  {
    id: 2,
    farmerName: "Mary Wanjiku",
    location: "Thika",
    coordinates: [-1.0332, 37.069],
    produce: "Spinach, Kale",
    dropTime: "11:00 AM",
    status: "in-progress",
    phone: "+254 723 456 789",
    estimatedValue: "KSh 1,800",
    weight: "18kg",
  },
  {
    id: 3,
    farmerName: "Peter Mwangi",
    location: "Ruiru",
    coordinates: [-1.1459, 36.9574],
    produce: "Potatoes, Onions",
    dropTime: "02:15 PM",
    status: "pending",
    phone: "+254 734 567 890",
    estimatedValue: "KSh 3,200",
    weight: "32kg",
  },
  {
    id: 4,
    farmerName: "Grace Nyambura",
    location: "Kikuyu",
    coordinates: [-1.2463, 36.6634],
    produce: "Beans, Maize",
    dropTime: "04:30 PM",
    status: "completed",
    phone: "+254 745 678 901",
    estimatedValue: "KSh 2,100",
    weight: "21kg",
  },
]

const sidebarItems = [
  { icon: MapPin, label: "Routes", active: true, count: 4 },
  { icon: Package, label: "Deliveries", count: 12 },
  { icon: Users, label: "Drivers", count: 8 },
  { icon: Route, label: "Optimize" },
  { icon: Clock, label: "Schedule" },
  { icon: Activity, label: "Analytics" },
  { icon: Settings, label: "Settings" },
]

const mockDrivers = [
  { id: 1, name: "James Ochieng", status: "active", deliveries: 3, avatar: "JO" },
  { id: 2, name: "Sarah Muthoni", status: "active", deliveries: 2, avatar: "SM" },
  { id: 3, name: "David Kiprop", status: "offline", deliveries: 0, avatar: "DK" },
]

export default function DeliveryMapUI() {
  const [selectedDelivery, setSelectedDelivery] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState("deliveries")

  return (
    <div className="h-screen bg-white flex overflow-hidden">
      {/* Left Sidebar */}
      <div
        className={`bg-white border-r border-gray-200 transition-all duration-300 ${sidebarCollapsed ? "w-16" : "w-80"} flex flex-col shadow-sm`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-xl font-bold text-gray-900">SafeMoon</h1>
                <p className="text-sm text-gray-500">Delivery Management</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {sidebarItems.map((item, index) => (
              <Button
                key={index}
                variant={item.active ? "secondary" : "ghost"}
                className={`w-full justify-start ${sidebarCollapsed ? "px-2" : "px-4"} ${
                  item.active
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {!sidebarCollapsed && (
                  <>
                    <span className="ml-3 flex-1 text-left">{item.label}</span>
                    {item.count && (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
                        {item.count}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
            ))}
          </div>
        </nav>

        {/* Tab Navigation */}
        {!sidebarCollapsed && (
          <div className="px-4 pb-2">
            <div className="flex bg-gray-50 rounded-lg p-1">
              <Button
                variant={activeTab === "deliveries" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("deliveries")}
                className={`flex-1 text-xs ${
                  activeTab === "deliveries" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Deliveries
              </Button>
              <Button
                variant={activeTab === "drivers" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("drivers")}
                className={`flex-1 text-xs ${
                  activeTab === "drivers" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Drivers
              </Button>
            </div>
          </div>
        )}

        {/* Content Area */}
        {!sidebarCollapsed && (
          <div className="flex-1 px-4 pb-4 overflow-y-auto">
            {activeTab === "deliveries" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Today's Deliveries</h3>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
                {mockDeliveries.map((delivery) => (
                  <Card
                    key={delivery.id}
                    className={`cursor-pointer transition-all hover:shadow-md border ${
                      selectedDelivery?.id === delivery.id
                        ? "ring-2 ring-blue-500 border-blue-200 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedDelivery(delivery)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="text-gray-900 font-medium text-sm">{delivery.farmerName}</p>
                          <p className="text-gray-500 text-xs">{delivery.location}</p>
                        </div>
                        <Badge
                          variant={
                            delivery.status === "completed"
                              ? "default"
                              : delivery.status === "in-progress"
                                ? "secondary"
                                : "outline"
                          }
                          className={`text-xs ${
                            delivery.status === "completed"
                              ? "bg-green-100 text-green-800 border-green-200"
                              : delivery.status === "in-progress"
                                ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                                : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          {delivery.status}
                        </Badge>
                      </div>
                      <p className="text-gray-700 text-xs mb-2">{delivery.produce}</p>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center text-gray-500">
                          <Clock className="h-3 w-3 mr-1" />
                          {delivery.dropTime}
                        </div>
                        <span className="text-gray-900 font-medium">{delivery.estimatedValue}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Active Drivers</h3>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    2 Online
                  </Badge>
                </div>
                {mockDrivers.map((driver) => (
                  <Card key={driver.id} className="border border-gray-200 bg-white hover:shadow-sm transition-all">
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">{driver.avatar}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{driver.name}</p>
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                driver.status === "active" ? "bg-green-500" : "bg-gray-300"
                              }`}
                            />
                            <span className="text-xs text-gray-500 capitalize">{driver.status}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Deliveries</p>
                          <p className="text-sm font-medium text-gray-900">{driver.deliveries}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom Actions */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <Button className="w-full mb-2 bg-blue-600 hover:bg-blue-700 text-white">
              <Route className="h-4 w-4 mr-2" />
              Optimize Routes
            </Button>
            <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
              <Users className="h-4 w-4 mr-2" />
              Assign Drivers
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search locations, farmers, or routes..."
                  className="pl-10 bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
                  <Navigation className="h-4 w-4 mr-2" />
                  Live Tracking
                </Button>
                <Button variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                  4 Active Routes
                </Badge>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 hover:bg-gray-50">
                <Bell className="h-5 w-5" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg?height=32&width=32" />
                  <AvatarFallback className="bg-gray-100 text-gray-600">DM</AvatarFallback>
                </Avatar>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">David Manager</p>
                  <p className="text-xs text-gray-500">Operations Lead</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-white border-b border-gray-100 p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">12</p>
              <p className="text-xs text-gray-500">Total Deliveries</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">4</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">2</p>
              <p className="text-xs text-gray-500">In Progress</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">6</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative bg-white">
          {/* Map Controls */}
          <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
            <Button
              variant="outline"
              size="icon"
              className="bg-white shadow-md border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="bg-white shadow-md border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="bg-white shadow-md border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Locate className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="bg-white shadow-md border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Layers className="h-4 w-4" />
            </Button>
          </div>

          {/* Map Legend */}
          <div className="absolute top-4 left-4 z-10">
            <Card className="bg-white shadow-md border border-gray-200">
              <CardContent className="p-3">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Legend</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                    <span className="text-xs text-gray-600">Pending</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-xs text-gray-600">In Progress</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-xs text-gray-600">Completed</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Map Component */}
          <MapComponent
            deliveries={mockDeliveries}
            selectedDelivery={selectedDelivery}
            onDeliverySelect={setSelectedDelivery}
          />

          {/* Selected Delivery Info Card */}
          {selectedDelivery && (
            <div className="absolute bottom-4 left-4 z-10">
              <Card className="w-80 bg-white shadow-lg border border-gray-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-gray-900">{selectedDelivery.farmerName}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={
                          selectedDelivery.status === "completed"
                            ? "default"
                            : selectedDelivery.status === "in-progress"
                              ? "secondary"
                              : "outline"
                        }
                        className={
                          selectedDelivery.status === "completed"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : selectedDelivery.status === "in-progress"
                              ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                        }
                      >
                        {selectedDelivery.status}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center text-sm">
                        <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-gray-900">{selectedDelivery.location}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Package className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-gray-900">{selectedDelivery.weight}</span>
                      </div>
                    </div>
                    <div className="flex items-center text-sm">
                      <Truck className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-gray-900">{selectedDelivery.produce}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center text-sm">
                        <Clock className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-gray-900">{selectedDelivery.dropTime}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Value: </span>
                        <span className="font-medium text-gray-900">{selectedDelivery.estimatedValue}</span>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex space-x-2 pt-2">
                      <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                        <Phone className="h-4 w-4 mr-2" />
                        Call
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Message
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        Navigate
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
