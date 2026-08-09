const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const KOLKATA_LOCATIONS = [
  { label: 'Park Street, Kolkata', lat: 22.5532, lng: 88.3524 },
  { label: 'Salt Lake Sector V, Kolkata', lat: 22.5726, lng: 88.4332 },
  { label: 'New Town Action Area I, Kolkata', lat: 22.5851, lng: 88.4682 },
  { label: 'Howrah Railway Station, Howrah, Kolkata', lat: 22.5840, lng: 88.3426 },
  { label: 'Netaji Subhash Chandra Bose International Airport (CCU), Kolkata', lat: 22.6520, lng: 88.4463 },
  { label: 'Gariahat Crossing, South Kolkata', lat: 22.5186, lng: 88.3653 },
  { label: 'Jadavpur University Campus, Kolkata', lat: 22.4988, lng: 88.3714 },
  { label: 'Sealdah Railway Station, Kolkata', lat: 22.5684, lng: 88.3703 },
  { label: 'Esplanade Central Bus Terminus, Kolkata', lat: 22.5645, lng: 88.3512 },
  { label: 'Alipore Zoo, Kolkata', lat: 22.5332, lng: 88.3332 },
  { label: 'Shyambazar Five Point Crossing, Kolkata', lat: 22.6000, lng: 88.3700 },
  { label: 'Ballygunge Phari, Kolkata', lat: 22.5280, lng: 88.3650 },
  { label: 'Tollygunge Metro Station, Kolkata', lat: 22.4930, lng: 88.3470 },
  { label: 'Behala Chowrasta, Kolkata', lat: 22.4980, lng: 88.3120 },
  { label: 'Salt Lake Sector I, Kolkata', lat: 22.5890, lng: 88.4080 },
  { label: 'Eco Park Gate 2, New Town, Kolkata', lat: 22.6030, lng: 88.4670 },
  { label: 'Prinsep Ghat, Strand Road, Kolkata', lat: 22.5560, lng: 88.3380 },
  { label: 'Victoria Memorial Hall, Kolkata', lat: 22.5448, lng: 88.3426 },
  { label: 'Science City, EM Bypass, Kolkata', lat: 22.5400, lng: 88.3960 },
  { label: 'Ruby General Hospital, EM Bypass, Kolkata', lat: 22.5130, lng: 88.3980 },
  { label: 'Ultadanga Hudco Crossing, Kolkata', lat: 22.5880, lng: 88.3890 },
  { label: 'Dunlop Bridge Crossing, North Kolkata', lat: 22.6510, lng: 88.3780 },
  { label: 'Kasba New Market, Kolkata', lat: 22.5210, lng: 88.3920 },
  { label: 'College Street Coffee House, Kolkata', lat: 22.5740, lng: 88.3630 },
  { label: 'Rabindra Sadan Cultural Center, Kolkata', lat: 22.5410, lng: 88.3480 },
];

const VEHICLE_MODELS = [
  'Hyundai Creta', 'Maruti Suzuki Swift', 'Tata Nexon EV', 'Honda City',
  'Mahindra Thar', 'Kia Seltos', 'Toyota Innova Crysta', 'Hyundai i20',
  'Maruti Baleno', 'Tata Harrier', 'MG Hector', 'Skoda Slavia',
];

const CHAT_MESSAGES = [
  'Hey, I am waiting near the pickup point in Kolkata!',
  'Running 2 mins late due to EM Bypass traffic.',
  'Great, see you in a minute!',
  'Reached the location. Yellow taxi in front.',
  'Thanks for the ride!',
  'Please share the 4-digit boarding OTP.',
  'OTP verified, starting the journey.',
  'Smooth drive today on Maa Flyover!',
];

async function main() {
  console.log('🌱 Starting Comprehensive Kolkata Database Seeding (500 Records Per Model)...');

  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  // 1. SEED 500 ORGS
  console.log('🏢 Seeding 500 Organizations...');
  const orgsData = [
    {
      id: 'platform-org-id',
      name: 'Platform Core Admin Org',
      slug: 'platform-core-admin',
      status: 'ACTIVE',
      subsidyPercent: 10.0,
      baseRideCharge: 20.0,
    },
    {
      id: 'acme-corp-org-id',
      name: 'Acme Corporation Kolkata',
      slug: 'acme-corporation',
      status: 'ACTIVE',
      subsidyPercent: 15.0,
      baseRideCharge: 15.0,
    },
  ];

  for (let i = 2; i < 500; i++) {
    orgsData.push({
      id: `org-kolkata-${i}`,
      name: `Kolkata Tech Enterprise ${i}`,
      slug: `kolkata-tech-enterprise-${i}`,
      status: 'ACTIVE',
      subsidyPercent: 10.0,
      baseRideCharge: 20.0,
    });
  }

  await prisma.org.createMany({
    data: orgsData,
    skipDuplicates: true,
  });

  const allOrgs = await prisma.org.findMany({ select: { id: true } });
  console.log(`✅ Seeded ${allOrgs.length} Organizations.`);

  // 2. SEED 500 USERS
  console.log('👤 Seeding 500 Users...');
  const usersData = [
    {
      id: 'user-super-admin-id',
      email: 'superadmin@platform.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+919830000000',
      role: 'SUPER_ADMIN',
      verificationStatus: 'APPROVED',
      orgId: 'platform-org-id',
    },
    {
      id: 'user-org-admin-id',
      email: 'admin@acme.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Acme',
      lastName: 'Admin',
      phone: '+919830000001',
      employeeId: 'EMP-0001',
      role: 'ORG_ADMIN',
      verificationStatus: 'APPROVED',
      orgId: 'acme-corp-org-id',
    },
    {
      id: 'user-john-doe-id',
      email: 'john.doe@acme.com',
      passwordHash: defaultPasswordHash,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+919830000002',
      employeeId: 'EMP-9842',
      role: 'USER',
      verificationStatus: 'APPROVED',
      orgId: 'acme-corp-org-id',
    },
  ];

  const firstNames = ['Debasish', 'Srabani', 'Pritam', 'Ananya', 'Sourav', 'Subham', 'Pooja', 'Rohan', 'Sneha', 'Aritra', 'Tiyasa', 'Rajdeep', 'Swati', 'Vikram'];
  const lastNames = ['Banerjee', 'Chatterjee', 'Mukherjee', 'Dutta', 'Sarkar', 'Chowdhury', 'Ghosh', 'Roy', 'Ganguly', 'Sen', 'Bhowmick', 'Das', 'Bhattacharya'];

  for (let i = 3; i < 500; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const assignedOrg = allOrgs[i % allOrgs.length].id;

    usersData.push({
      id: `user-kolkata-${i}`,
      email: `user${i}@kolkatacarpool.com`,
      passwordHash: defaultPasswordHash,
      firstName: `${fn}`,
      lastName: `${ln} ${i}`,
      phone: `+91983${String(i).padStart(7, '0')}`,
      employeeId: `WB-EMP-${1000 + i}`,
      role: 'USER',
      verificationStatus: 'APPROVED',
      orgId: assignedOrg,
    });
  }

  await prisma.user.createMany({
    data: usersData,
    skipDuplicates: true,
  });

  const allUsers = await prisma.user.findMany({ select: { id: true, firstName: true, lastName: true, orgId: true } });
  console.log(`✅ Seeded ${allUsers.length} Users.`);

  // 3. SEED WALLETS (including John Doe)
  console.log('💳 Seeding Wallets (500+ Transactions for John Doe)...');
  const walletsData = allUsers.map((u, idx) => ({
    id: u.id === 'user-john-doe-id' ? 'wallet-john-doe-id' : `wallet-kolkata-${idx}`,
    userId: u.id,
    balance: u.id === 'user-john-doe-id' ? '25000.00' : (500 + (idx * 37) % 4500).toFixed(2),
  }));

  await prisma.wallet.createMany({
    data: walletsData,
    skipDuplicates: true,
  });

  const allWallets = await prisma.wallet.findMany({ select: { id: true, userId: true } });
  const johnWallet = allWallets.find(w => w.userId === 'user-john-doe-id') || allWallets[0];
  console.log(`✅ Seeded ${allWallets.length} Wallets.`);

  // 4. SEED VEHICLES (500 Vehicles for John Doe)
  console.log('🚗 Seeding 500 Vehicles for John Doe...');
  const vehiclesData = [];
  for (let i = 0; i < 500; i++) {
    vehiclesData.push({
      id: `vehicle-john-${i}`,
      model: VEHICLE_MODELS[i % VEHICLE_MODELS.length],
      registrationNumber: `WB-02-JD-${1000 + i}`,
      seatingCapacity: (i % 3) + 3,
      fuelType: (['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID'])[i % 4],
      status: 'VERIFIED',
      ownerId: 'user-john-doe-id',
    });
  }
  allUsers.forEach((u, idx) => {
    if (u.id !== 'user-john-doe-id') {
      vehiclesData.push({
        id: `vehicle-kolkata-${idx}`,
        model: VEHICLE_MODELS[idx % VEHICLE_MODELS.length],
        registrationNumber: `WB-02-K-${1000 + idx}`,
        seatingCapacity: (idx % 3) + 3,
        fuelType: (['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID'])[idx % 4],
        status: 'VERIFIED',
        ownerId: u.id,
      });
    }
  });

  await prisma.vehicle.createMany({
    data: vehiclesData,
    skipDuplicates: true,
  });

  const johnVehicles = await prisma.vehicle.findMany({ where: { ownerId: 'user-john-doe-id' } });
  const allVehicles = await prisma.vehicle.findMany({ select: { id: true, ownerId: true } });
  console.log(`✅ Seeded ${johnVehicles.length} Vehicles for John Doe.`);

  // 5. SEED SAVED PLACES (500 Saved Places for John Doe)
  console.log('📍 Seeding 500 Saved Places for John Doe...');
  const savedPlacesData = [];
  for (let i = 0; i < 500; i++) {
    const loc = KOLKATA_LOCATIONS[i % KOLKATA_LOCATIONS.length];
    savedPlacesData.push({
      id: `savedplace-john-${i}`,
      label: i % 2 === 0 ? `Home Landmark #${i + 1}` : `Office Branch #${i + 1}`,
      address: `${loc.label} (Sector ${i + 1})`,
      latitude: loc.lat,
      longitude: loc.lng,
      userId: 'user-john-doe-id',
    });
  }

  await prisma.savedPlace.createMany({
    data: savedPlacesData,
    skipDuplicates: true,
  });
  console.log(`✅ Seeded ${savedPlacesData.length} Saved Places for John Doe.`);

  // 6. SEED RIDES (500 Rides driven by John Doe)
  console.log('🛣️ Seeding 500 Rides for John Doe (Kolkata Routes)...');
  const ridesData = [];
  const now = Date.now();

  for (let i = 0; i < 500; i++) {
    const pickup = KOLKATA_LOCATIONS[i % KOLKATA_LOCATIONS.length];
    const dest = KOLKATA_LOCATIONS[(i + 5) % KOLKATA_LOCATIONS.length];
    const veh = johnVehicles[i % johnVehicles.length];

    // 250 completed (for Ride History), 250 scheduled (for Active Offered Rides)
    const isCompleted = i < 250;
    const departureAt = isCompleted
      ? new Date(now - (i + 1) * 3600000 * 12)
      : new Date(now + (i + 1) * 3600000 * 4);

    ridesData.push({
      id: `ride-john-${i}`,
      pickupLabel: pickup.label,
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      destinationLabel: dest.label,
      destinationLat: dest.lat,
      destinationLng: dest.lng,
      departureAt,
      availableSeats: (i % 3) + 1,
      farePerSeat: (60 + (i % 15) * 10).toFixed(2),
      status: isCompleted ? 'COMPLETED' : 'SCHEDULED',
      routeDistanceKm: 8.5 + (i % 20),
      routeDurationMinutes: 20 + (i % 30),
      isRecurring: i % 4 === 0,
      driverId: 'user-john-doe-id',
      vehicleId: veh.id,
      orgId: 'acme-corp-org-id',
    });
  }

  await prisma.ride.createMany({
    data: ridesData,
    skipDuplicates: true,
  });

  const johnRides = await prisma.ride.findMany({ where: { driverId: 'user-john-doe-id' } });
  console.log(`✅ Seeded ${johnRides.length} Rides for John Doe.`);

  // 7. SEED JOIN REQUESTS (500 Join Requests for John Doe's Rides)
  console.log('📩 Seeding 500 Join Requests for John Doe...');
  const joinRequestsData = [];
  for (let i = 0; i < 500; i++) {
    const ride = johnRides[i % johnRides.length];
    const passenger = allUsers.find(u => u.id !== 'user-john-doe-id' && u.id === `user-kolkata-${(i % 495) + 3}`) || allUsers[0];

    joinRequestsData.push({
      id: `req-john-${i}`,
      initiatedBy: i % 2 === 0 ? 'PASSENGER' : 'DRIVER',
      agreedFare: ride.farePerSeat,
      seatsRequested: 1,
      status: ride.status === 'COMPLETED' ? 'ACCEPTED' : (i % 2 === 0 ? 'ACCEPTED' : 'PENDING'),
      rideId: ride.id,
      passengerId: passenger.id,
    });
  }

  await prisma.joinRequest.createMany({
    data: joinRequestsData,
    skipDuplicates: true,
  });

  const johnJoinRequests = await prisma.joinRequest.findMany({ select: { id: true, rideId: true, passengerId: true, agreedFare: true } });
  console.log(`✅ Seeded ${johnJoinRequests.length} Join Requests.`);

  // 8. SEED 500 NEGOTIATIONS
  console.log('💬 Seeding 500 Negotiations...');
  const negotiationsData = [];
  for (let i = 0; i < 500; i++) {
    const ride = allRides[i % allRides.length];
    const passenger = allUsers[(i + 2) % allUsers.length];
    const req = allJoinRequests[i % allJoinRequests.length];

    negotiationsData.push({
      id: `neg-kolkata-${i}`,
      status: i % 3 === 0 ? 'ACCEPTED' : i % 3 === 1 ? 'OPEN' : 'REJECTED',
      rideId: ride.id,
      passengerId: passenger.id,
      requestId: req.id,
    });
  }

  await prisma.negotiation.createMany({
    data: negotiationsData,
    skipDuplicates: true,
  });

  const allNegotiations = await prisma.negotiation.findMany({ select: { id: true, rideId: true } });
  console.log(`✅ Seeded ${allNegotiations.length} Negotiations.`);

  // 9. SEED 500 NEGOTIATION OFFERS
  console.log('🗣️ Seeding 500 Negotiation Offers...');
  const negotiationOffersData = [];
  for (let i = 0; i < 500; i++) {
    const neg = allNegotiations[i % allNegotiations.length];
    negotiationOffersData.push({
      id: `offer-kolkata-${i}`,
      offeredBy: i % 2 === 0 ? 'PASSENGER' : 'DRIVER',
      amount: (50 + (i % 20) * 10).toFixed(2),
      negotiationId: neg.id,
    });
  }

  await prisma.negotiationOffer.createMany({
    data: negotiationOffersData,
    skipDuplicates: true,
  });
  console.log(`✅ Seeded ${negotiationOffersData.length} Negotiation Offers.`);

  // 10. SEED 500 BOOKINGS
  console.log('🎟️ Seeding 500 Bookings...');
  const bookingsData = [];
  for (let i = 0; i < 500; i++) {
    const req = allJoinRequests[i];
    const ride = allRides.find(r => r.id === req.rideId) || allRides[i % allRides.length];

    bookingsData.push({
      id: `booking-kolkata-${i}`,
      seatsBooked: 1,
      totalFare: req.agreedFare,
      requestId: req.id,
      rideId: ride.id,
      passengerId: req.passengerId,
    });
  }

  await prisma.booking.createMany({
    data: bookingsData,
    skipDuplicates: true,
  });

  const allBookings = await prisma.booking.findMany({ select: { id: true, requestId: true, rideId: true, passengerId: true } });
  console.log(`✅ Seeded ${allBookings.length} Bookings.`);

  // 11. SEED 500 TRIPS
  console.log('🚕 Seeding 500 Trips...');
  const tripsData = [];
  for (let i = 0; i < 500; i++) {
    const ride = allRides[i];
    const isCompleted = ride.status === 'COMPLETED' || i % 2 === 0;

    tripsData.push({
      id: `trip-kolkata-${i}`,
      status: isCompleted ? 'COMPLETED' : (i % 3 === 0 ? 'IN_PROGRESS' : 'SCHEDULED'),
      startedAt: new Date(now - (i * 3600000 + 3600000)),
      completedAt: isCompleted ? new Date(now - (i * 3600000 + 1800000)) : null,
      routeDistanceKm: ride.routeDistanceKm || 12.5,
      routeDurationMinutes: ride.routeDurationMinutes || 25,
      rideId: ride.id,
      driverId: ride.driverId,
    });
  }

  await prisma.trip.createMany({
    data: tripsData,
    skipDuplicates: true,
  });

  const allTrips = await prisma.trip.findMany({ select: { id: true, driverId: true, status: true } });
  console.log(`✅ Seeded ${allTrips.length} Trips.`);

  // 12. SEED 500 TRIP PASSENGERS
  console.log('👥 Seeding 500 Trip Passengers...');
  const tripPassengersData = [];
  for (let i = 0; i < 500; i++) {
    const trip = allTrips[i % allTrips.length];
    const passenger = allUsers[(i + 4) % allUsers.length];
    tripPassengersData.push({
      id: `trippassenger-kolkata-${i}`,
      seatsBooked: 1,
      fareAmount: (70 + (i % 10) * 10).toFixed(2),
      paymentStatus: i % 2 === 0 ? 'PAID' : 'PENDING',
      tripId: trip.id,
      passengerId: passenger.id,
    });
  }

  await prisma.tripPassenger.createMany({
    data: tripPassengersData,
    skipDuplicates: true,
  });
  console.log(`✅ Seeded ${tripPassengersData.length} Trip Passengers.`);

  // 13. SEED 500 TRIP LOCATIONS (Kolkata Breadcrumbs)
  console.log('📍 Seeding 500 Trip Locations (Kolkata Breadcrumbs)...');
  const tripLocationsData = [];
  for (let i = 0; i < 500; i++) {
    const trip = allTrips[i % allTrips.length];
    const loc = KOLKATA_LOCATIONS[i % KOLKATA_LOCATIONS.length];
    tripLocationsData.push({
      id: `triploc-kolkata-${i}`,
      lat: loc.lat + (i % 10) * 0.001,
      lng: loc.lng + (i % 10) * 0.001,
      recordedAt: new Date(now - (i * 60000)),
      tripId: trip.id,
    });
  }

  await prisma.tripLocation.createMany({
    data: tripLocationsData,
    skipDuplicates: true,
  });
  console.log(`✅ Seeded ${tripLocationsData.length} Trip Locations.`);

  // 14. SEED 500 MESSAGES
  console.log('💬 Seeding 500 Messages...');
  const messagesData = [];
  for (let i = 0; i < 500; i++) {
    const trip = allTrips[i % allTrips.length];
    const sender = allUsers[i % allUsers.length];
    messagesData.push({
      id: `msg-kolkata-${i}`,
      content: CHAT_MESSAGES[i % CHAT_MESSAGES.length],
      createdAt: new Date(now - (i * 120000)),
      tripId: trip.id,
      senderId: sender.id,
    });
  }

  await prisma.message.createMany({
    data: messagesData,
    skipDuplicates: true,
  });
  console.log(`✅ Seeded ${messagesData.length} Messages.`);

  // 15. SEED 500 CALL LOGS
  console.log('📞 Seeding 500 Call Logs...');
  const callLogsData = [];
  for (let i = 0; i < 500; i++) {
    const trip = allTrips[i % allTrips.length];
    const caller = allUsers[i % allUsers.length];
    const receiver = allUsers[(i + 1) % allUsers.length];
    callLogsData.push({
      id: `call-kolkata-${i}`,
      startedAt: new Date(now - (i * 300000)),
      endedAt: new Date(now - (i * 300000) + 45000),
      durationSec: 45 + (i % 120),
      tripId: trip.id,
      callerId: caller.id,
      receiverId: receiver.id,
    });
  }

  await prisma.callLog.createMany({
    data: callLogsData,
    skipDuplicates: true,
  });
  console.log(`✅ Seeded ${callLogsData.length} Call Logs.`);

  // 16. SEED 500 PAYMENTS
  console.log('💳 Seeding 500 Payments...');
  const paymentsData = [];
  for (let i = 0; i < 500; i++) {
    const trip = allTrips[i % allTrips.length];
    const booking = allBookings[i % allBookings.length];
    paymentsData.push({
      id: `payment-kolkata-${i}`,
      amount: (80 + (i % 15) * 10).toFixed(2),
      method: (['WALLET', 'CASH', 'CARD', 'UPI'])[i % 4],
      status: i % 2 === 0 ? 'PAID' : 'PENDING',
      razorpayOrderId: `order_kolkata_${1000 + i}`,
      razorpayPaymentId: `pay_kolkata_${1000 + i}`,
      bookingId: booking.id,
      tripId: trip.id,
    });
  }

  await prisma.payment.createMany({
    data: paymentsData,
    skipDuplicates: true,
  });

  const allPayments = await prisma.payment.findMany({ select: { id: true } });
  console.log(`✅ Seeded ${allPayments.length} Payments.`);

  // 17. SEED 500 WALLET TRANSACTIONS
  console.log('📊 Seeding 500 Wallet Transactions...');
  const walletTransactionsData = [];
  for (let i = 0; i < 500; i++) {
    const wallet = allWallets[i % allWallets.length];
    const payment = allPayments[i % allPayments.length];
    walletTransactionsData.push({
      id: `wtx-kolkata-${i}`,
      type: i % 2 === 0 ? 'CREDIT' : 'DEBIT',
      amount: (100 + (i % 20) * 50).toFixed(2),
      description: i % 2 === 0 ? 'Wallet recharge via Razorpay UPI' : `Trip fare deduction #${i}`,
      walletId: wallet.id,
      paymentId: payment.id,
    });
  }

  await prisma.walletTransaction.createMany({
    data: walletTransactionsData,
    skipDuplicates: true,
  });
  console.log(`✅ Seeded ${walletTransactionsData.length} Wallet Transactions.`);

  // 18. SEED 500 FARE BREAKDOWNS
  console.log('🧮 Seeding 500 Fare Breakdowns...');
  const fareBreakdownsData = [];
  for (let i = 0; i < 500; i++) {
    const trip = allTrips[i];
    fareBreakdownsData.push({
      id: `farebd-kolkata-${i}`,
      distanceKm: 10.5 + (i % 15),
      durationMin: 22.0 + (i % 25),
      fuelComponent: (50 + (i % 10) * 5).toFixed(2),
      baseFee: '20.00',
      orgSubsidy: '10.00',
      finalPerRider: (60 + (i % 10) * 5).toFixed(2),
      tripId: trip.id,
    });
  }

  await prisma.fareBreakdown.createMany({
    data: fareBreakdownsData,
    skipDuplicates: true,
  });
  console.log(`✅ Seeded ${fareBreakdownsData.length} Fare Breakdowns.`);

  console.log('🎉 Full Database Seeding Completed Successfully with 500 Kolkata Records for Every Field!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
