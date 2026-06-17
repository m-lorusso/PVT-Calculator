ASSIGN melbourne2.tmy 3

*Revised 20/07/15 - for use with domestic system decks.

*--------do not change below this line --------------

const 8
LAT = -37.8
SHFT =  -5.03
TLOAD = 45
REFC = 0.2
SLOPE = 20
AZ =   45
Gas_ref_eff=0.788
zone = 4

UNIT 13 TYPE 14
*Seasonal Load Pattern
PARAMETERS 48
   0, 0.70   744, 0.70
 744, 0.80  1416, 0.80
1416, 0.85  2160, 0.85
2160, 0.90  2880, 0.90
2880, 0.95  3624, 0.95
3624, 1.00  4344, 1.00
4344, 1.00  5088, 1.00
5088, 1.00  5832, 1.00
5832, 1.00  6552, 1.00
6552, 0.95  7296, 0.95
7296, 0.90  8016, 0.90
8016, 0.80  8760, 0.80

UNIT 14 TYPE 14
*Daily Load Pattern - domestic systems
PARAMETERS 68
 0,  0.000   7,  0.000
 7,  0.150   7.1,0.150
 7.1,0       8,  0
 8,  0.150   8.1,0.150
 8.1,0      11,  0
11,  0.100  11.1,0.100
11.1,0      13,  0
13,  0.100  13.1,0.100
13.1,0      15,0
15,  0.125  15.1,0.125
15.1,0      16,  0
16,  0.125  16.1,0.125
16.1,0      17,  0
17,  0.125  17.1,0.125
17.1,0      18,  0
18,  0.125  18.1,0.125
18.1,0      24,  0

UNIT 17 TYPE 14
*Monthly cold water temperature
PARAMETERS 48
   0, 20.0   744, 20.0
 744, 20.0  1416, 20.0
1416, 18.0  2160, 18.0
2160, 15.0  2880, 15.0
2880, 11.0  3624, 11.0
3624,  9.0  4344,  9.0
4344,  8.0  5088,  8.0
5088, 10.0  5832, 10.0
5832, 12.0  6552, 12.0
6552, 15.0  7296, 15.0
7296, 17.0  8016, 17.0
8016, 19.0  8760, 19.0

UNIT 49 TYPE 14 DAYS IN MONTH
*Used to convert data to a daily basis
PARAMETERS 48
   0,31   744,31
 744,28  1416,28
1416,31  2160,31
2160,30  2880,30
2880,31  3624,31
3624,30  4344,30
4344,31  5088,31
5088,31  5832,31
5832,30  6552,30
6552,31  7296,31
7296,30  8016,30
8016,31  8760,31

constants 3
*approximate thermal conductivity of water in kJ/(h m K)
kfluid=0.6 * 3.6
*change of external heat transfer coefficient CS28 Sep 2007
hout= 20 * 3.6
*internal heat transfer coefficient in collector loop pipe and load flow pipe in kJ/(h m^2 K)
hin = 1000 * 3.6

UNIT 9 TYPE 9
*Weather data card reader
PARAMETERS 24
1 0 9 1 -4 10 0 -5 10 0 6 .1 0 7 .1 0 8 .1 0 -9 1 0 3 1
(1X,3F2.0,5F3.0,2x,f1.0)
*Ouput 4 is horizontal hourly irradiation
*Ouput 5 is beam sun tracking irradiation
*Ouput 6 is ambient temperature
*Ouput 7 is wind speed
*Ouput 8 is wet bulb temperature
*Ouput 9 is cloud cover

eqns 11
Tcold = [17,1]
Tamb  = [9,6] 
Twet  = [9,8]
GH    = [9,4]
Gb    = [9,5]
CC    = [9,9] 

*Set peak daily winter load in MJ/day
PKLOAD = 25.2*eql(load_size,1)+42*eql(load_size,2)+63*eql(load_size,3)

*Seasonal daily energy delivery - varies month to month
dyengy = [13,1] * PKLOAD

*Set number of startup losses for each load (8/day) for instantaneous gas booster
Nevents = (13*eql(load_size,1)+19*eql(load_size,2)+26*eql(load_size,3))/8

*Electric offpeak reference system annual energy use 
Ref_elec = 10280*eql(load_size,1)+16670*eql(load_size,2)+23140*eql(load_size,3)

*Gas storage water heater (3 star) reference system annual energy use
Ref_gas = 17930*eql(load_size,1)+24720*eql(load_size,2)+33240*eql(load_size,3)

UNIT 16 TYPE 16 RADIATION PROCESSOR
PARAMETERS 9
4 1 2 1 lat 4871 shft  2 -1 
INPUTS 9
GH  GB  9,99 9,100   0,0  0,0 0,0  9,104 9,105
 0   0    0  0      REFC SLOPE AZ   0      0

unit 33 type 33  Psychrometics Dew point temp
parameters 4
1 1 0 2
inputs 2
Tamb Twet
20   20

eqn 3
Tdp =  [33,8]  !  Dew point temperature in Deg. C
Tsky = (0.711+0.0056*Tdp+0.73*10^(-4)*Tdp^2)^(0.25)*(Tamb+273.15) -273.15
*CER definition for Tambc (/5)
Tambc = Tamb -(Tamb-Tsky)/5*lt(gh,1)  ! Night time effective ambient temperature 

eqn 1
*Domestic systems mass flow rate for 0.1 h load flow period in kg/h
ldflw = dyengy*[14,1]/(TLOAD-Tcold)/0.00418/0.1
