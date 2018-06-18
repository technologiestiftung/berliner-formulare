const 	request = require('request-promise'),
		cheerio = require('cheerio'),
		fs = require('fs'),
		download_path = __dirname + '/pdfs/' 

if (!fs.existsSync(download_path)) {
    fs.mkdirSync(download_path)
}

let options = {
    uri: 'https://service.berlin.de/dienstleistungen/',
    transform: function (body) {
        return cheerio.load(body, {xmlMode: true});
    }
};
 
request(options)
	.then(function ($) {
		let items = []
		$('.azlist ul.list a').each( (i, item) => {
			let link = 'https://service.berlin.de' + $(item).attr('href'),
				title = $(item).text()
			items.push({
				title:cleanStr(title),
				link:link
			})
		})
		processItems(items)
	})
	.catch(function (err) {
		console.log('request-error', err)
	})

function processItems(items){
	Promise.all(items.map(function(item) {
		let options = {
			timeout:120000,
			pool: {maxSockets: 6},
			uri: item.link,
			transform: function (body) {
				return cheerio.load(body);
			}
		}

		console.log(item.link)

		return request(options).then(function($) {
			let pdf_links = []
			$('a').each((i, item)=>{
				let href = $(item).attr('href'),
					text = cleanStr($(item).text())
				if(href.indexOf('.pdf')>-1){
					pdf_links.push({
						link:href,
						name:text,
						type:'pdf'
					})
				}else if(href.indexOf('/intelliform/')>-1){
					pdf_links.push({
						link:href,
						name:text,
						type:'online-form'
					})
				}else if(text.indexOf('Termin buchen')>-1){
					let service_link = '',
						service_name = ''

					let p = $(item).parent()
					while(p.attr('class')!='row'){
						p = $(p).parent()
					}
					if(p.find('.span5 a').length==1){
						service_link = 'https://service.berlin.de' + $(p).find('.span5 a').attr('href')
						service_name = $(p).find('.span5 a').text()
					}else{
						service_name = $(p).find('.span5 strong').text()
					}
					pdf_links.push({
						link:href,
						name:service_name,
						service_link:service_link,
						type:'service'
					})
				}
			})
			return pdf_links
		}).catch(function (err) {
			console.log('processItems-error', err)
		})

	})).then(function(values) {
	  	items.forEach((item,i)=>{
	  		items[i]['detailLink'] = values[i]
	  		item.detailLink.forEach((link,l)=>{
	  			if(link.type == 'pdf'){
	  				let url = link.link,
	  					filename =  url.split('/').pop()

	  				if(url.indexOf('https://www.google.de')>-1){
	  					let s1 = url.split('url='),
	  						s2 = s1[1].split('&')

	  					url = decodeURIComponent(s2[0])
	  					filename =  url.split('/').pop()
	  				}
	  				items[i].detailLink[l]['file'] = filename
	  				if (!fs.existsSync(download_path+filename)) {
						request.get(url)
			    			.pipe(fs.createWriteStream(download_path+filename))
			    	}

	  			}
	  		})

	  	})
	  
		fs.writeFileSync('forms.json', JSON.stringify(items), 'utf8')
	})
}

function cleanStr(str){
	str = str.split('\n').join('')
	return str.trim()
}