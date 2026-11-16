'use strict';

// GIPHY id of a women's demo GIF per exercise. Shown from GIPHY's servers
// (i.giphy.com) as their embed terms allow, with a "via GIPHY" credit.
const GIFS = {
 "Bench Press": "3YHsKO2NLc9dfygzXK",
 "Cable Lateral Raise": "xT8qBikQMiEkfvI2yc",
 "Cable Row": "0mhHK2Tkcxxf2mwaR6",
 "Calf Raise": "l0O9zLnU1siBibNvi",
 "Chest Press": "3YHsKO2NLc9dfygzXK",
 "DB Shoulder Press": "9yCgVNO31uoiJvPykh",
 "Dead Bug": "Rih75Cs5BrWhdJIGmu",
 "Dumbbell Biceps Curl": "su9dsDPFWARqfBNda2",
 "Dumbbell Romanian Deadlift": "SvFIaLoR5rcoRLQrOE",
 "Easy cycling": "VhuyZntmWVCpljEkJa",
 "Easy treadmill walk": "27GxVbjxGEy0AkO3bR",
 "Face Pull": "RtQGbdJmnbUktIPO9f",
 "Flat Bench Press": "3YHsKO2NLc9dfygzXK",
 "Glute Bridge": "nEwnWfKsZRT20",
 "Goblet Squat": "IGDBIiEreJYB2",
 "Incline DB Press": "3obcMOGo49fb78A54V",
 "Incline Dumbbell Press": "3obcMOGo49fb78A54V",
 "Lat Pulldown": "IpX7IpR2SzDMtQza2p",
 "Lat Pulldown Machine": "IpX7IpR2SzDMtQza2p",
 "Lateral Raise": "xT8qBikQMiEkfvI2yc",
 "Leg Curl": "inBiRmFKrwDKg",
 "Low Row Machine": "0mhHK2Tkcxxf2mwaR6",
 "Mobility and stretching": "BjcuSuiuq7d65XZkLd",
 "One-arm Dumbbell Row": "YpRudHivjRJt90mT1z",
 "Plank": "d3mlADRlF7SMFQRy",
 "Romanian Deadlift": "SvFIaLoR5rcoRLQrOE",
 "Seated Cable Row": "0mhHK2Tkcxxf2mwaR6",
 "Seated Row": "0mhHK2Tkcxxf2mwaR6",
 "Shoulder Press": "9yCgVNO31uoiJvPykh",
 "Standing Calf Raise": "l0O9zLnU1siBibNvi",
 "Tricep Pushdown": "RrjMzT0JQLJcuawgGF",
 "Tricep Rope Pushdown": "RrjMzT0JQLJcuawgGF"
};
