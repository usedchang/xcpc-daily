#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int n;cin>>n;
    vector<ll>a(n+1);
    vector<ll>b(n+1);
    vector<int>p(n+1);
    iota(p.begin(),p.end(),0);
    for(int i=1;i<=n;i++) cin>>a[i]>>b[i];
    sort(p.begin()+1,p.end(),[&](int x,int y){
        if(max(a[x],b[x])!=max(a[y],b[y])) return max(a[x],b[x])<max(a[y],b[y]);
        if(a[x]!=a[y]) return a[x]<a[y];
        return b[x]<b[y];
    });
    ll x=0,ans=0;
    for(int i=1;i<=n;i++){
        if(x<=a[p[i]]){
            x=max(x,b[p[i]]);
            ans++;
        }
    }
    cout<<ans<<endl;
    return 0;
}