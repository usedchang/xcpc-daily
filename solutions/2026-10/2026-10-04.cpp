#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
vector<int>zf(const string &s){
    int n=s.size();
    vector<int>z(n);
    z[0]=n;
    for(int i=1,l=0,r=0;i<n;i++){
        if(i<r) z[i]=min(r-i,z[i-l]);
        while(i+z[i]<n&&s[z[i]]==s[i+z[i]]) z[i]++;
        if(i+z[i]>r){
            l=i,r=i+z[i];
        }
    }
    return z;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    string s,t;
    cin>>s>>t;
    int n=s.size(),m=t.size();
    string rs=s;
    reverse(rs.begin(),rs.end());
    vector<int>z=zf(t+'#'+rs);
    vector<int>las(n+1);
    for(int j=0;j<n;j++) las[j]=z[m+n-j];
    string T="$#";
    for(char c:s) T+=c,T+='#';
    T+='^';
    int lenT=T.size();
    vector<int>p(lenT);
    for(int i=1,mx=0,mid=0;i<lenT;i++){
        if(i<mx) p[i]=min(mx-i,p[2*mid-i]);
        else p[i]=1;
        while(T[i-p[i]]==T[i+p[i]]) ++p[i];
        if(i+p[i]>mx){
            mx=i+p[i];
            mid=i;
        }
    }
    vector<ll>d(n+3);
    for(int i=1;i<lenT;i++){
        int len=p[i]-1;
        if(!len) continue;
        int l=(i-len-1)/2;
        int s=(len+1)/2;
        d[l]++;
        d[l+s]--;
    }
    for(int i=1;i<=n;i++) d[i]+=d[i-1];
    ll ans=0;
    for(int i=0;i<n;i++) ans+=las[i]*d[i+1];
    cout<<ans<<endl;
    return 0;
}