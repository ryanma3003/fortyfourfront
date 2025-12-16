import { width } from "../prismCode/advancedUi/placeholder";
import { fontSizes } from "../prismCode/ui-elements/typography";

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
	},
	tooltip: {
		style: {
			fontSize: '12px'
		}
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
		plotOptions: {
		radar: {
			size: 140,
			offsetX: 20,
			offsetY: 0
		}
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
	responsive: [
    // ========== 4K / Monitor besar ==========
    {
      breakpoint: 1920,
      options: {
        chart: { height: 500 },
        plotOptions: { radar: { size: 180 } },
        xaxis: { labels: { style: { fontSize: "12px" } } },
        legend: { fontSize: "13px" },
        tooltip: { style: { fontSize: "10px" } }
      }
    },
    {
      breakpoint: 1600,
      options: {
        chart: { height: 500 },
        plotOptions: { radar: { size: 150 } },
        xaxis: { labels: { style: { fontSize: "10px" } } },
        legend: { fontSize: "12px" },
        tooltip: { style: { fontSize: "10px" } }
      }
    },

    // ========== Laptop besar (1440px) ==========
    {
      breakpoint: 1400,
      options: {
        chart: { height: 500 },
        plotOptions: { radar: { size: 130 } },
        xaxis: { labels: { style: { fontSize: "7.5px" } } },
        legend: { fontSize: "11px" },
        tooltip: { style: { fontSize: "9px" } }
      }
    },

    // ========== Laptop sedang (1200px) ==========
    {
      breakpoint: 1200,
      options: {
        chart: { height: 340 },
        plotOptions: { radar: { size: 130 } },
        xaxis: { labels: { style: { fontSize: "8.5px" } } },
        legend: { fontSize: "10px" },
        tooltip: { style: { fontSize: "9px" } }
      }
    },

    // ========== Tablet landscape (992px) ==========
    {
      breakpoint: 992,
      options: {
        chart: { height: 320 },
        plotOptions: { radar: { size: 110 } },
        xaxis: { labels: { style: { fontSize: "7.5px" } } },
        legend: { fontSize: "9.5px" },
        tooltip: { style: { fontSize: "9px" } }
      }
    },

    // ========== Tablet portrait (768px) ==========
    {
      breakpoint: 768,
      options: {
        chart: { height: 300 },
        plotOptions: { radar: { size: 90 } },
        xaxis: { labels: { style: { fontSize: "6px" } } },
        yaxis: {
          min: 0,
          max: 5,
          tickAmount: 10,
          labels: { style: { fontSize: "7px" } }
        },
        legend: {
          fontSize: "9px"
        },
        tooltip: { style: { fontSize: "9px" } }
      }
    },

    // ========== Mobile (480px) ==========
    {
      breakpoint: 480,
      options: {
        chart: { height: 260 },
        plotOptions: { radar: { size: 90 } },
        xaxis: { labels: { style: { fontSize: "5px" } } },
        yaxis: {
          min: 0,
          max: 5,
          tickAmount: 10,
          labels: { style: { fontSize: "6px" } }
        },
        legend: {
          fontSize: "8px",
          offsetY: 20,
          labels: {
            formatter: (name: string) =>
              `<span style="font-size: 8px">${name}</span>`
          }
        },
        tooltip: { style: { fontSize: "8px" } }
      }
    }
  ],
	tooltip: {
		style: {
			fontSize: '12px'
		}
	}
}

export const Multiseries2 = [
  {
    name: "Target Nilai Kematangan",
    data: Array(19).fill(2.51)
  },
  {
    name: "Nilai Kematangan",
    data: Array(19).fill(1)
  }
];

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
    }
  },

  title: {
    text: "Perkategori",
    align: "left",
    style: {
      fontSize: "13px",
      fontWeight: "bold",
      color: "#000"
    }
  },

  colors: ["#985ffd", "#ff49cd", "#fdaf22"],
  stroke: { width: 2 },
  fill: { opacity: 0 },
  markers: { size: 3 },

  plotOptions: {
    radar: { size: 120 }
  },

  xaxis: {
    categories: [
      "Total",
      "Mengindentifikasi Peran dan Tanggung Jawab organisasi",
      "Menyusun strategi, kebijakan, dan prosedur Keamanan Siber",
      "Mengelola aset informasi",
      "Menilai dan mengelola risiko Keamanan Siber",
      "Mengelola risiko rantai pasok",
      "Mengelola identitas, autentikasi dan kendali akses",
      "Melindungi aset fisik",
      "Melindungi data",
      "Melindungi aplikasi",
      "Melindungi jaringan",
      "Melindungi sumber daya manusia",
      "Mengelola deteksi Peristiwa Siber",
      "Menganalisis anomali dan Peristiwa Siber",
      "Memantau Peristiwa Siber berkelanjutan",
      "Menyusun perancanaan penanggulangan dan pemulihan Insiden Siber",
      "Menganalisi dan melaporkan Insiden Siber",
      "Melaksanakan penanggulangan dan pemulihan Insiden Siber",
      "Meningkatkan Keamanan setelah terjadinya insiden Siber"
    ],

    labels: {
      formatter: function (label: string) {
        const max = 30;
        const arr = [];
        let line = "";
        for (const word of label.split(" ")) {
          if ((line + word).length > max) {
            arr.push(line);
            line = word + " ";
          } else {
            line += word + " ";
          }
        }
        arr.push(line);
        return arr;
      },
      style: { fontSize: "7px" }
    }
  },

  yaxis: {
    min: 0,
    max: 5,
    tickAmount: 10,
    labels: {
      style: { fontSize: "9px" },
      formatter: (val: number) => val.toFixed(1)
    }
  },

  legend: {
    position: "bottom",
    fontSize: "10px",
	offsetY: 0,
    labels: {
      fontSize: "10px",
      formatter: (value: string) => value
    }
  },

 responsive: [
    // ========== 4K / Monitor besar ==========
    {
      breakpoint: 1920,
      options: {
        chart: { height: 500 },
        plotOptions: { radar: { size: 170 } },
        xaxis: { labels: { style: { fontSize: "11px" } } },
        legend: { fontSize: "13px" },
        tooltip: { style: { fontSize: "10px" } }
      }
    },
    {
      breakpoint: 1600,
      options: {
        chart: { height: 500 },
        plotOptions: { radar: { size: 150 } },
        xaxis: { labels: { style: { fontSize: "9px" } } },
        legend: { fontSize: "12px" },
        tooltip: { style: { fontSize: "9px" } }
      }
    },

    // ========== Laptop besar (1440px) ==========
    {
      breakpoint: 1400,
      options: {
        chart: { height: 500 },
        plotOptions: { radar: { size: 115 } },
        xaxis: { labels: { style: { fontSize: "7.5px" } } },
        legend: { fontSize: "11px" },
        tooltip: { style: { fontSize: "9px" } }
      }
    },

    // ========== Laptop sedang (1200px) ==========
    {
      breakpoint: 1200,
      options: {
        chart: { height: 340 },
        plotOptions: { radar: { size: 130 } },
        xaxis: { labels: { style: { fontSize: "8.5px" } } },
        legend: { fontSize: "10px" },
        tooltip: { style: { fontSize: "9px" } }
      }
    },

    // ========== Tablet landscape (992px) ==========
    {
      breakpoint: 992,
      options: {
        chart: { height: 320 },
        plotOptions: { radar: { size: 110 } },
        xaxis: { labels: { style: { fontSize: "7.5px" } } },
        legend: { fontSize: "9.5px" },
        tooltip: { style: { fontSize: "9px" } }
      }
    },

    // ========== Tablet portrait (768px) ==========
    {
      breakpoint: 768,
      options: {
        chart: { height: 300 },
        plotOptions: { radar: { size: 90 } },
        xaxis: { labels: { style: { fontSize: "6px" } } },
        yaxis: {
          min: 0,
          max: 5,
          tickAmount: 10,
          labels: { style: { fontSize: "7px" } }
        },
        legend: {
          fontSize: "9px"
        },
        tooltip: { style: { fontSize: "9px" } }
      }
    },

    // ========== Mobile (480px) ==========
    {
      breakpoint: 480,
      options: {
        chart: { height: 260 },
        plotOptions: { radar: { size: 90 } },
        xaxis: { labels: { style: { fontSize: "5px" } } },
        yaxis: {
          min: 0,
          max: 5,
          tickAmount: 10,
          labels: { style: { fontSize: "6px" } }
        },
        legend: {
          fontSize: "8px",
          offsetY: 20,
          labels: {
            formatter: (name: string) =>
              `<span style="font-size: 8px">${name}</span>`
          }
        },
        tooltip: { style: { fontSize: "8px" } }
      }
    }
  ],
	tooltip: {
		style: {
			fontSize: '12px'
		}
	}

};




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
		style: {
			fontSize: '12px'
		}
	},
	responsive: [
		// ========== 4K / Monitor besar ==========
		{
			breakpoint: 1920,
			options: {
				chart: { height: 400 },
				plotOptions: { radar: { size: 120 } },
				tooltip: { style: { fontSize: "13px" } }
			}
		},

		// ========== Laptop besar (1440px) ==========
		{
			breakpoint: 1400,
			options: {
				chart: { height: 380 },
				plotOptions: { radar: { size: 100 } },
				tooltip: { style: { fontSize: "9px" } }
			}
		},

		// ========== Laptop sedang (1200px) ==========
		{
			breakpoint: 1200,
			options: {
				chart: { height: 350 },
				plotOptions: { radar: { size: 90 } },
				tooltip: { style: { fontSize: "9px" } }
			}
		},

		// ========== Tablet landscape (992px) ==========
		{
			breakpoint: 992,
			options: {
				chart: { height: 330 },
				plotOptions: { radar: { size: 80 } },
				tooltip: { style: { fontSize: "10px" } }
			}
		},

		// ========== Tablet portrait (768px) ==========
		{
			breakpoint: 768,
			options: {
				chart: { height: 300 },
				plotOptions: { radar: { size: 70 } },
				tooltip: { style: { fontSize: "9px" } }
			}
		},

		// ========== Mobile (480px) ==========
		{
			breakpoint: 480,
			options: {
				chart: { height: 260 },
				plotOptions: { radar: { size: 60 } },
				tooltip: { style: { fontSize: "8px" } }
			}
		}
	],
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