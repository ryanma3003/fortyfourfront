import { width } from "../prismCode/advancedUi/placeholder";

//Basic Radar Chart
export const Radarseries = [{
	name: "Series 1",
	data: [80, 50, 30, 40, 100, 20],
}]
export const Radaroptions = {
	chart: {
		height: 320,
		type: "radar",
		events: {
			mounted: (chart: { windowResizeHandler: () => void; }) => {
				chart.windowResizeHandler();
			}

		},
	},
	title: {
		text: "Basic Radar Chart",
		align: "left",
		style: {
			fontSize: "13px",
			fontWeight: "bold",
			color: "#8c9097"
		},
	},
	colors: ["#985ffd"],
	xaxis: {
		categories: ["January", "February", "March", "April", "May", "June"],
		labels: {
			style: {
				fontSize: '9px',
			},
		},
	}
}

// Radar Chart-Multiple Series
export const Multiseries = [{
	name: "Target Nilai Kematangan",
	data: Array(4).fill(2.51)
}, {
	name: "Nilai Kematangan",
	data: [0.5, 2.5, 1.5, 2.5],
}]
export const Multioptions = {
	chart: {
		height: 350,
		type: "radar",
		
		dropShadow: {
			enabled: true,
			blur: 1,
			left: 1,
			top: 1
		},
		events: {
			mounted: (chart: { windowResizeHandler: () => void; }) => {
				chart.windowResizeHandler();
			}

		},
	},
	title: {
		text: "Perdomain",
		align: "left",
		style: {
			fontSize: "13px",
			fontWeight: "bold",
			color: "#8c9097"
		},
	},
	colors: ['#985ffd', '#ff49cd', '#fdaf22'],
	stroke: {
		width: 2
	},
	fill: {
		opacity: 0
	},
	markers: {
		size: 3
	},
	xaxis: {
		 categories: [
			["identifikasi"],
			["Proteksi"],
			["Deteksi"],
			["Penanggulangan", "dan pemulihan"]
		],
		labels: {
			style: {
				fontSize: '9px',
				// colors: Array(19).fill('#000'), // semua label jadi hitam
				// color: '#000'
			},
			offsetY: -0.5,
			formatter: function (val: string) {
				if (val.length > 12) {
					return val.replace(" dan ", "\n");
				}
			   return val;
		   }
	   }
	},
	yaxis: {
	min: 0,
	max: 5,
	tickAmount: 10,
	labels: {
		style: {
		fontSize: '9px',
		},
		formatter: function (val: number) {
		return val.toFixed(1); 
		}
	}
	},
}

export const Multiseries2 = [{
	name: "Target Nilai Kematangan",
	data: Array(19).fill(2.51)
}, {
	name: "Nilai Kematangan",
	data: Array(19).fill(1),
	// data: [0.5, 2.5, 1.5, 2.5],
}]
export const Multioptions2 = {
	chart: {
		height: 350,
		type: "radar",
		
		dropShadow: {
			enabled: true,
			blur: 1,
			left: 1,
			top: 1
		},
		events: {
			mounted: (chart: { windowResizeHandler: () => void; }) => {
				chart.windowResizeHandler();
			}

		},
	},
	title: {
		text: "Perkategori",
		align: "left",
		style: {
			fontSize: "13px",
			fontWeight: "bold",
			color: "#000000ff"
		},
	},
	colors: ['#985ffd', '#ff49cd', '#fdaf22'],
	stroke: {
		width: 2
	},
	fill: {
		opacity: 0
	},
	markers: {
		size: 3
	},
	plotOptions: {
		radar: {
			size: 140,
			offsetX: 0,
			offsetY: 0
		}
	},
	xaxis: {
		categories: [
			["Total"],
			["Mengindentifikasi Peran", "dan Tanggung Jawab organisasi"],
			["Menyusun strategi, kebijakan,", "dan prosedur Keamanan Siber"],
			["Mengelola aset informasi"],
			["Menilai dan mengelola risiko", "Keamanan Siber"],
			["Mengelola risiko rantai pasok"],
			["Mengelola identitas, autentikasi", "dan kendali akses"],
			["Melindungi aset fisik"],
			["Melindungi data"],
			["Melindungi aplikasi"],
			["Melindungi jaringan"],
			["Melindungi sumber daya manusia"],
			["Mengelola deteksi Peristiwa Siber"],
			["Menganalisis anomali dan ", "Peristiwa Siber"],
			["Memantau Peristiwa Siber", "berkelanjutan"],
			["Menyusun perancanaan penanggulangan", "dan pemulihan Insiden Siber"],
			["Menganalisi dan melaporkan", "Insiden Siber"],
			["Melaksanakan penanggulangan", "dan pemulihan Insiden Siber"],
			["Meningkatkan Keamanan setelah ","terjadinya insiden Siber"]
		],
		labels: {
			style: {
				fontSize: '9px',
				// colors: Array(19).fill('#000'), // semua label jadi hitam
				// color: '#000'
			},
			offsetX: 0,
			offsetY: -0.5,
			formatter: function (val: string) {
				if (val.length > 12) {
					return val.replace(" dan ", "\n");
				}
			   return val;
		   }
	   }
	},
	yaxis: {
	min: 0,
	max: 5,
	tickAmount: 10,
	labels: {
		style: {
		fontSize: '9px',
		},
		formatter: function (val: number) {
		return val.toFixed(1); 
		}
	}
	}
}


// Radar Chart Polygon Fill
export const Ploygonseries = [{
	name: "Series 1",
	data: [20, 10, 40, 30, 50, 80, 33],
}]
export const Polygonoptions = {
	chart: {
		height: 320,
		type: "radar",
		events: {
			mounted: (chart: { windowResizeHandler: () => void; }) => {
				chart.windowResizeHandler();
			}

		},
	},
	dataLabels: {
		enabled: true
	},
	plotOptions: {
		radar: {
			size: 80,
			polygons: {
				strokeColors: "#e9e9e9",
			}
		}
	},
	title: {
		text: "Radar with Polygon Fill",
		align: "left",
		style: {
			fontSize: "13px",
			fontWeight: "bold",
			color: "#8c9097"
		},
	},
	colors: ['#ff49cd'],
	markers: {
		size: 4,
		colors: ["#fff"],
		strokeWidth: 2,
	},
	tooltip: {
		y: {
			formatter: (val: string) => {
				return val.toString(); // Convert to string
			}
		}
	},
	xaxis: {
		categories: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
	},
	yaxis: {
		tickAmount: 7,
		labels: {
			formatter: (val: string, i: number) => {
				if (i % 2 === 0) {
					return val.toString(); // Convert to string
				} else {
					return "";
				}
			}
		}
	}
}
